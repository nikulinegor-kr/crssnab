import { useState, useRef, useCallback, type DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, Loader2, Check, AlertTriangle, File, Trash2,
  MoveRight, Sparkles, FileText, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface IncomingFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  status: "uploading" | "classifying" | "classified" | "unclassified" | "moving" | "processing" | "done" | "error";
  sectionName?: string | null;
  sectionId?: string | null;
  folderId?: string | null;
  docType?: string | null;
  confidence?: number;
  error?: string;
}

interface Section {
  id: string;
  name: string;
  object_id: string;
}

interface Folder {
  id: string;
  section_id: string | null;
  name: string;
  type: string;
}

interface IncomingUploadsProps {
  orgId: string;
  objectId: string;
  objectName: string;
  year: number;
  sections: Section[];
  folders: Folder[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  statement: "Ведомость",
  kp: "КП",
  estimate: "Смета",
  drawing: "Чертёж",
  other: "Другое",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploading: { label: "Загрузка...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  classifying: { label: "Определение...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  classified: { label: "Определён", icon: <Check className="h-3 w-3" />, variant: "default" },
  unclassified: { label: "Не определён", icon: <AlertTriangle className="h-3 w-3" />, variant: "destructive" },
  moving: { label: "Перемещение...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  processing: { label: "Обработка...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  done: { label: "Готово", icon: <Check className="h-3 w-3" />, variant: "default" },
  error: { label: "Ошибка", icon: <AlertTriangle className="h-3 w-3" />, variant: "destructive" },
};

export function IncomingUploads({
  orgId,
  objectId,
  objectName,
  year,
  sections,
  folders,
}: IncomingUploadsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<IncomingFile[]>([]);
  const [manualSectionDialog, setManualSectionDialog] = useState<IncomingFile | null>(null);
  const [manualSectionId, setManualSectionId] = useState<string>("");

  const objectSections = sections.filter((s) => s.object_id === objectId);

  const updateFile = (id: string, updates: Partial<IncomingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const incomingFile: IncomingFile = {
      id: tempId,
      fileName: file.name,
      fileUrl: "",
      fileType,
      status: "uploading",
    };

    setFiles((prev) => [...prev, incomingFile]);

    try {
      // 1. Upload to storage
      const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext || "pdf"}`;
      const path = `${orgId}/${year}/${objectId}/incoming/${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from("material-statements")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("material-statements")
        .getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // 2. Create statement record (no section/folder yet)
      const { data: stData, error: stError } = await (supabase
        .from("material_statements" as any)
        .insert({
          organization_id: orgId,
          object_id: objectId,
          folder_id: null,
          section_id: null,
          year,
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType,
          is_recognized: false,
          classification_status: "pending",
        })
        .select("id")
        .single() as any);

      if (stError) throw stError;

      const statementId = stData.id;
      updateFile(tempId, { id: statementId, fileUrl, status: "classifying" });

      // 3. Classify
      const { data: classifyData, error: classifyError } = await supabase.functions.invoke(
        "classify-document",
        {
          body: {
            statementId,
            organizationId: orgId,
            objectId,
            fileName: file.name,
            fileUrl,
          },
        }
      );

      if (classifyError) throw classifyError;

      const result = classifyData as any;

      if (result.classificationStatus === "classified" && result.folderId) {
        updateFile(tempId, {
          id: statementId,
          status: "classified",
          sectionName: result.sectionName,
          sectionId: result.sectionId,
          folderId: result.folderId,
          docType: result.docType,
          confidence: result.confidence,
        });

        // Auto-process: trigger recognition for statements
        if (result.docType === "statement" && fileType === "pdf") {
          updateFile(tempId, { status: "processing" });
          try {
            await supabase.functions.invoke("recognize-materials", {
              body: { fileUrl, statementId, organizationId: orgId },
            });
            updateFile(tempId, { status: "done" });
          } catch {
            updateFile(tempId, { status: "done" }); // file is placed, recognition failed
          }
        } else {
          updateFile(tempId, { status: "done" });
        }

        queryClient.invalidateQueries({ queryKey: ["material-statements"] });
        queryClient.invalidateQueries({ queryKey: ["material-items"] });
      } else {
        updateFile(tempId, {
          id: statementId,
          status: "unclassified",
          sectionName: result.sectionName,
          docType: result.docType,
          confidence: result.confidence,
        });
      }
    } catch (err: any) {
      updateFile(tempId, { status: "error", error: err.message });
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    }
  };

  const handleFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => processFile(file));
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [orgId, objectId, year]);

  const handleManualAssign = async () => {
    if (!manualSectionDialog || !manualSectionId) return;
    const file = manualSectionDialog;

    // Find "Работы и материалы" folder for this section
    const docType = file.docType || "statement";
    const folderType = docType === "statement" || docType === "kp" ? "materials" : "general_docs";
    const targetFolder = folders.find(
      (f) => f.section_id === manualSectionId && f.type === folderType
    );

    if (!targetFolder) {
      toast({ title: "Папка не найдена", description: "Создайте раздел с папками сначала", variant: "destructive" });
      return;
    }

    const section = sections.find((s) => s.id === manualSectionId);

    updateFile(file.id, { status: "moving" });
    setManualSectionDialog(null);

    try {
      // Update statement
      await (supabase.from("material_statements" as any).update({
        folder_id: targetFolder.id,
        section_id: manualSectionId,
        classification_status: "classified",
      }).eq("id", file.id) as any);

      // Save learned rule
      const baseName = file.fileName.replace(/\.[^.]+$/, "").toLowerCase();
      // Extract meaningful pattern (first word or abbreviation)
      const words = baseName.split(/[\s_\-\.]+/).filter((w) => w.length > 1);
      if (words.length > 0 && section) {
        const pattern = words.slice(0, 3).join(" ");
        await (supabase.from("classification_rules" as any).upsert({
          organization_id: orgId,
          pattern,
          section_name: section.name,
          doc_type: file.docType || "statement",
        }, { onConflict: "organization_id,pattern" }) as any);
      }

      // Trigger recognition if it's a statement PDF
      if ((file.docType === "statement" || !file.docType) && file.fileType === "pdf") {
        updateFile(file.id, { status: "processing", sectionName: section?.name, sectionId: manualSectionId, folderId: targetFolder.id });
        try {
          await supabase.functions.invoke("recognize-materials", {
            body: { fileUrl: file.fileUrl, statementId: file.id, organizationId: orgId },
          });
        } catch {
          // Recognition failed but file is placed
        }
      }

      updateFile(file.id, { status: "done", sectionName: section?.name, sectionId: manualSectionId, folderId: targetFolder.id });
      queryClient.invalidateQueries({ queryKey: ["material-statements"] });
      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      toast({ title: "Файл распределён" });
    } catch (err: any) {
      updateFile(file.id, { status: "error", error: err.message });
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const hasActiveFiles = files.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{objectName}</h1>
        <p className="text-sm text-muted-foreground">
          {year} год — <span className="font-medium text-foreground">Входящие</span>
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.doc,.docx,.dwg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <div
          className={cn(
            "p-3 rounded-full transition-colors",
            isDragOver ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Upload
            className={cn(
              "h-8 w-8 transition-colors",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="text-center">
          <p className="text-base font-medium">
            {isDragOver ? "Отпустите файлы для загрузки" : "Перетащите файлы сюда"}
          </p>
          <p className="text-sm text-muted-foreground">
            или нажмите для выбора · PDF, Excel, DWG, DOC
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Система автоматически определит раздел и тип документа
          </p>
        </div>
      </div>

      {/* Files Status Table */}
      {hasActiveFiles && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Загруженные файлы ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Файл</TableHead>
                  <TableHead>Раздел</TableHead>
                  <TableHead>Тип документа</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const statusConfig = STATUS_CONFIG[file.status];
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="flex items-center gap-2">
                        {file.fileType === "pdf" ? (
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[300px]">{file.fileName}</span>
                      </TableCell>
                      <TableCell>
                        {file.sectionName ? (
                          <span className="font-medium">{file.sectionName}</span>
                        ) : file.status === "unclassified" ? (
                          <span className="text-muted-foreground italic">Не определён</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {file.docType ? (
                          <Badge variant="outline" className="text-xs">
                            {DOC_TYPE_LABELS[file.docType] || file.docType}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig?.variant || "secondary"} className="gap-1">
                          {statusConfig?.icon}
                          {statusConfig?.label || file.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {file.status === "unclassified" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setManualSectionDialog(file);
                                setManualSectionId("");
                              }}
                            >
                              <MoveRight className="h-3 w-3 mr-1" /> Раздел
                            </Button>
                          )}
                          {(file.status === "done" || file.status === "error") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFile(file.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Instruction when empty */}
      {!hasActiveFiles && (
        <div className="text-center text-muted-foreground py-8 space-y-2">
          <p className="text-sm">Загрузите файлы — система автоматически:</p>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" /> Определит раздел
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" /> Определит тип
            </Badge>
            <Badge variant="outline" className="gap-1">
              <MoveRight className="h-3 w-3" /> Распределит по папкам
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3" /> Извлечёт материалы
            </Badge>
          </div>
        </div>
      )}

      {/* Manual Section Assignment Dialog */}
      <Dialog open={!!manualSectionDialog} onOpenChange={(open) => { if (!open) setManualSectionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выберите раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Файл: <strong>{manualSectionDialog?.fileName}</strong>
            </p>
            {manualSectionDialog?.docType && (
              <p className="text-sm text-muted-foreground">
                Тип: <Badge variant="outline">{DOC_TYPE_LABELS[manualSectionDialog.docType] || manualSectionDialog.docType}</Badge>
              </p>
            )}
            <div>
              <label className="text-sm font-medium">Раздел</label>
              <Select value={manualSectionId} onValueChange={setManualSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent>
                  {objectSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {objectSections.length === 0 && (
              <p className="text-sm text-destructive">
                Нет разделов. Сначала создайте раздел для этого объекта.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualSectionDialog(null)}>
              Отмена
            </Button>
            <Button onClick={handleManualAssign} disabled={!manualSectionId}>
              <MoveRight className="h-4 w-4 mr-1" /> Распределить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
