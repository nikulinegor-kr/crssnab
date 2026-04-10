import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Trash2, CheckCircle, AlertCircle, Receipt } from "lucide-react";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RecognizedReceipt {
  id: string;
  file: File;
  fileUrl?: string;
  fileName: string;
  status: "pending" | "recognizing" | "done" | "error";
  amount: number | null;
  date: string | null;
  name: string | null;
  category: string;
}

interface ReceiptManagerProps {
  receipts: RecognizedReceipt[];
  onReceiptsChange: (receipts: RecognizedReceipt[]) => void;
  month: number;
  year: number;
  organizationId: string | null;
}

const CATEGORIES = ["ГСМ", "Интернет", "Доставка", "Прочее"];

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const ReceiptManager = ({
  receipts,
  onReceiptsChange,
  month,
  year,
  organizationId,
}: ReceiptManagerProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const uploadAndRecognize = useCallback(async (file: File): Promise<RecognizedReceipt> => {
    const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const receipt: RecognizedReceipt = {
      id: receiptId,
      file,
      fileName: file.name,
      status: "recognizing",
      amount: null,
      date: null,
      name: null,
      category: "Прочее",
    };

    try {
      const filePath = `receipts/${organizationId}/${year}-${month}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("request-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("request-documents")
        .getPublicUrl(filePath);

      receipt.fileUrl = urlData.publicUrl;

      const { data, error } = await supabase.functions.invoke("recognize-receipt", {
        body: {
          fileUrl: urlData.publicUrl,
          fileName: file.name,
          fileType: file.type,
        },
      });

      if (error) throw error;

      receipt.amount = data.amount;
      receipt.date = data.date;
      receipt.name = data.name;
      receipt.category = data.category || "Прочее";
      receipt.status = "done";
    } catch (err) {
      console.error("Receipt recognition error:", err);
      receipt.status = "error";
    }

    return receipt;
  }, [organizationId, year, month]);

  const handleFilesChange = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    setFiles([]);
    setIsProcessing(true);

    const newReceipts: RecognizedReceipt[] = [];
    let currentReceipts = [...receipts];

    for (const file of newFiles) {
      const result = await uploadAndRecognize(file);
      newReceipts.push(result);
      currentReceipts = [...currentReceipts, result];
      onReceiptsChange(currentReceipts);
    }

    setIsProcessing(false);

    const successCount = newReceipts.filter(r => r.status === "done").length;
    const errorCount = newReceipts.filter(r => r.status === "error").length;

    toast({
      title: "Чеки обработаны",
      description: `Распознано: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ""}`,
    });
  }, [receipts, onReceiptsChange, uploadAndRecognize, toast]);

  const handleDelete = (id: string) => {
    onReceiptsChange(receipts.filter(r => r.id !== id));
  };

  const handleCategoryChange = (id: string, category: string) => {
    onReceiptsChange(receipts.map(r => r.id === id ? { ...r, category } : r));
  };

  const handleDownloadPdf = async () => {
    if (receipts.length === 0) return;

    setIsDownloading(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const mergedPdf = await PDFDocument.create();

      for (const receipt of receipts) {
        if (!receipt.fileUrl) continue;

        const response = await fetch(receipt.fileUrl);
        const bytes = await response.arrayBuffer();

        if (receipt.file.type === "application/pdf" || receipt.fileName.toLowerCase().endsWith(".pdf")) {
          const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        } else {
          let image;
          if (receipt.file.type === "image/png" || receipt.fileName.toLowerCase().endsWith(".png")) {
            image = await mergedPdf.embedPng(bytes);
          } else {
            image = await mergedPdf.embedJpg(bytes);
          }

          const page = mergedPdf.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
        }
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Чеки_${MONTH_NAMES_RU[month - 1]}_${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Успешно", description: "PDF с чеками скачан" });
    } catch (err) {
      console.error("PDF merge error:", err);
      toast({ title: "Ошибка", description: "Не удалось создать PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const grouped = receipts
    .filter(r => r.status === "done" && r.amount)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + (r.amount || 0);
      return acc;
    }, {});

  const totalAmount = Object.values(grouped).reduce((a, b) => a + b, 0);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Чеки</h2>
            {receipts.length > 0 && (
              <Badge variant="secondary">{receipts.length}</Badge>
            )}
          </div>
          {receipts.length > 0 && (
            <Button
              onClick={handleDownloadPdf}
              variant="outline"
              size="sm"
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Скачать чеки PDF
            </Button>
          )}
        </div>

        <MultiFileDropZone
          accept="image/jpeg,image/png,application/pdf"
          files={files}
          onFilesChange={handleFilesChange}
          label="Загрузить чеки"
          hint="JPG, PNG или PDF, до 10 МБ каждый, максимум 20 файлов"
          icon="document"
          maxSizeMB={10}
          maxFiles={20}
        />

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Распознавание чеков...
          </div>
        )}

        {Object.keys(grouped).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CATEGORIES.filter(c => grouped[c]).map(cat => (
              <div key={cat} className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">{cat}</div>
                <div className="text-lg font-bold">
                  {grouped[cat].toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                </div>
              </div>
            ))}
          </div>
        )}

        {receipts.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-[40px]">№</TableHead>
                  <TableHead>Файл / Название</TableHead>
                  <TableHead className="w-[140px]">Категория</TableHead>
                  <TableHead className="w-[120px] text-right">Сумма</TableHead>
                  <TableHead className="w-[110px]">Дата</TableHead>
                  <TableHead className="w-[80px]">Статус</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt, idx) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {receipt.name || receipt.fileName}
                        </span>
                        {receipt.name && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {receipt.fileName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={receipt.category}
                        onValueChange={(v) => handleCategoryChange(receipt.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {receipt.amount != null
                        ? receipt.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {receipt.date || "—"}
                    </TableCell>
                    <TableCell>
                      {receipt.status === "recognizing" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {receipt.status === "done" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {receipt.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(receipt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {totalAmount > 0 && (
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell></TableCell>
                    <TableCell>ИТОГО:</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {totalAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
};
