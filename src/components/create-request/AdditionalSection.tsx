import { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { FormSectionCard } from "./FormSectionCard";
import { MoreHorizontal, Copy, FileText, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdditionalSectionProps {
  form: UseFormReturn<any>;
  formValues: any;
  objectsData: Array<{ id: string; name: string }> | undefined;
  photoFiles: File[];
  setPhotoFiles: (files: File[]) => void;
  documentFiles: File[];
  setDocumentFiles: (files: File[]) => void;
  disabled?: boolean;
  existingPhotoUrls?: string[];
  onRemoveExistingPhoto?: (url: string) => void;
  existingDocumentUrls?: string[];
  onRemoveExistingDocument?: (url: string) => void;
  organizationId?: string | null;
}

export const AdditionalSection = ({
  form,
  formValues,
  objectsData,
  photoFiles,
  setPhotoFiles,
  documentFiles,
  setDocumentFiles,
  disabled = false,
  existingPhotoUrls,
  onRemoveExistingPhoto,
  existingDocumentUrls,
  onRemoveExistingDocument,
  organizationId,
}: AdditionalSectionProps) => {
  const { toast } = useToast();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [lastZrsFile, setLastZrsFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleCopyZRS = async () => {
    const zrsText = `Объект: ${objectsData?.find(o => o.id === formValues.object_id)?.name || "-"}
Заявка: ${formValues.description || "-"}
Заявитель: ${formValues.applicant || "-"}
Приоритет: ${formValues.priority || "-"}
Наличие: ${formValues.availability_delivery_time || "-"}
Срок доставки: ${formValues.estimated_delivery_days ? `${formValues.estimated_delivery_days} дн.` : "-"}
Оплата: ${formValues.payment_percentage ?? 0}%
Исполнил: ${formValues.executor || "-"}`;
    
    try {
      await navigator.clipboard.writeText(zrsText);
      toast({ title: "Скопировано", description: "Текст ЗРС скопирован в буфер обмена" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать текст", variant: "destructive" });
    }
  };

  const getZrsLines = () => {
    const objectName = objectsData?.find(o => o.id === formValues.object_id)?.name || "-";
    return [
      `Объект: ${objectName}`,
      `Заявка: ${formValues.description || "-"}`,
      `Заявитель: ${formValues.applicant || "-"}`,
      `Приоритет: ${formValues.priority || "-"}`,
      `Наличие: ${formValues.availability_delivery_time || "-"}`,
      `Срок доставки: ${formValues.estimated_delivery_days ? `${formValues.estimated_delivery_days} дн.` : "-"}`,
      `Оплата: ${formValues.payment_percentage ?? 0}%`,
      `Исполнил: ${formValues.executor || "-"}`,
    ];
  };

  const handleInsertIntoInvoice = () => {
    pdfInputRef.current?.click();
  };

  const handlePdfFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit);
      
      const fontBytes = await fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);

      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      const lines = getZrsLines();
      const fontSize = 9;
      const lineHeight = 14;
      // Place text in the bottom-right corner
      const startX = width * 0.55;
      let startY = 20 + (lines.length - 1) * lineHeight;

      lines.forEach((line) => {
        firstPage.drawText(line, {
          x: startX,
          y: startY,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
        startY -= lineHeight;
      });

      const modifiedPdf = await pdfDoc.save();
      const blob = new Blob([modifiedPdf.buffer as ArrayBuffer], { type: "application/pdf" });
      const newFileName = file.name.replace(".pdf", "_ZRS.pdf");
      const modifiedFile = new File([blob], newFileName, { type: "application/pdf" });

      // Add to document files so it appears in the Счёт/КП block below
      setDocumentFiles([...documentFiles, modifiedFile]);
      setLastZrsFile(modifiedFile);

      toast({ title: "Готово", description: "Сводка ЗРС вставлена в счёт и добавлена в документы" });
    } catch (err) {
      console.error("PDF insert error:", err);
      toast({ title: "Ошибка", description: "Не удалось обработать PDF. Убедитесь, что файл не защищён.", variant: "destructive" });
    }
  };

  const handleSendToTelegram = async () => {
    if (!lastZrsFile || !organizationId) return;
    setIsSending(true);
    try {
      // Upload file to storage
      const filePath = `zrs/${Date.now()}_${lastZrsFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("request-documents")
        .upload(filePath, lastZrsFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("request-documents")
        .getPublicUrl(filePath);

      const zrsText = getZrsLines().join("\n");

      const { error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          action: "send_zrs_document",
          organization_id: organizationId,
          document_url: urlData.publicUrl,
          file_name: lastZrsFile.name,
          caption: `📋 ЗРС — Счёт\n\n${zrsText}`,
        },
      });
      if (error) throw error;
      toast({ title: "Отправлено", description: "Счёт с ЗРС отправлен в Telegram" });
    } catch (err) {
      console.error("Send ZRS error:", err);
      toast({ title: "Ошибка", description: "Не удалось отправить в Telegram", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <FormSectionCard 
      title="Дополнительно" 
      icon={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
      collapsible
      defaultCollapsed
    >
      <div className="space-y-3 sm:space-y-4">
        {/* ZRS Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-xs">ЗРС (сводка заявки)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfFileSelected}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInsertIntoInvoice}
                className="h-7"
              >
                <FileText className="h-3 w-3 mr-1" />
                Вставить в счёт
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyZRS}
                className="h-7"
              >
                <Copy className="h-3 w-3 mr-1" />
                Копировать
              </Button>
              {lastZrsFile && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = URL.createObjectURL(lastZrsFile);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = lastZrsFile.name;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="h-7"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Скачать PDF
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSendToTelegram}
                    disabled={isSending}
                    className="h-7"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {isSending ? "Отправка..." : "Отправить"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <Textarea
            readOnly
            className="min-h-[80px] sm:min-h-[100px] bg-muted/50 font-mono text-xs"
            value={`Объект: ${objectsData?.find(o => o.id === formValues.object_id)?.name || "-"}
Заявка: ${formValues.description || "-"}
Заявитель: ${formValues.applicant || "-"}
Приоритет: ${formValues.priority || "-"}
Наличие: ${formValues.availability_delivery_time || "-"}
Срок доставки: ${formValues.estimated_delivery_days ? `${formValues.estimated_delivery_days} дн.` : "-"}
Оплата: ${formValues.payment_percentage}%
Исполнил: ${formValues.executor || "-"}`}
          />
        </div>

        {/* Files */}
        {!disabled ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MultiFileDropZone
            accept="image/*"
            files={photoFiles}
            onFilesChange={setPhotoFiles}
            existingUrls={existingPhotoUrls}
            onRemoveExisting={onRemoveExistingPhoto}
            label="Фото заявки"
            hint="JPG, PNG, WEBP до 5 МБ, макс. 10"
            icon="image"
            maxSizeMB={5}
            maxFiles={10}
          />

          <MultiFileDropZone
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            files={documentFiles}
            onFilesChange={setDocumentFiles}
            existingUrls={existingDocumentUrls}
            onRemoveExisting={onRemoveExistingDocument}
            label="Документы (Счёт/КП)"
            hint="PDF, DOC, XLS до 10 МБ, макс. 10"
            icon="document"
            maxSizeMB={10}
            maxFiles={10}
          />
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Фото ({existingPhotoUrls?.length || 0})</Label>
            {existingPhotoUrls?.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                Фото {i + 1}
              </a>
            ))}
            {(!existingPhotoUrls || existingPhotoUrls.length === 0) && <p className="text-sm text-muted-foreground">Нет фото</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Документы ({existingDocumentUrls?.length || 0})</Label>
            {existingDocumentUrls?.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                Документ {i + 1}
              </a>
            ))}
            {(!existingDocumentUrls || existingDocumentUrls.length === 0) && <p className="text-sm text-muted-foreground">Нет документов</p>}
          </div>
        </div>
        )}
      </div>
    </FormSectionCard>
  );
};
