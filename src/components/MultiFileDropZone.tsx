import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openStoredFile } from "@/lib/storageUrl";

interface MultiFileDropZoneProps {
  accept: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  existingUrls?: string[];
  onRemoveExisting?: (url: string) => void;
  label: string;
  hint: string;
  icon?: "image" | "document";
  maxSizeMB?: number;
  maxFiles?: number;
  /** В формах заявок: сначала равные зоны выбора, затем списки вложений. */
  attachmentsBelow?: boolean;
}

export const MultiFileDropZone = ({
  accept,
  files,
  onFilesChange,
  existingUrls = [],
  onRemoveExisting,
  label,
  hint,
  icon = "document",
  maxSizeMB = 10,
  maxFiles = 10,
  attachmentsBelow = false,
}: MultiFileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const validateFile = (file: File): boolean => file.size <= maxSizeMB * 1024 * 1024;

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(validateFile);
    const totalFiles = files.length + existingUrls.length + validFiles.length;
    if (totalFiles > maxFiles) {
      const allowedCount = maxFiles - files.length - existingUrls.length;
      onFilesChange([...files, ...validFiles.slice(0, allowedCount)]);
    } else {
      onFilesChange([...files, ...validFiles]);
    }
  }, [onFilesChange, files, existingUrls.length, maxFiles, maxSizeMB]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(validateFile);
    const totalFiles = files.length + existingUrls.length + validFiles.length;
    if (totalFiles > maxFiles) {
      const allowedCount = maxFiles - files.length - existingUrls.length;
      onFilesChange([...files, ...validFiles.slice(0, allowedCount)]);
    } else {
      onFilesChange([...files, ...validFiles]);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemoveFile = (index: number) => onFilesChange(files.filter((_, i) => i !== index));

  const getFileName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const fileName = urlObj.pathname.split("/").pop() || "file";
      const match = fileName.match(/^(\d+)-(.*)$/);
      return decodeURIComponent(match ? match[2] : fileName);
    } catch {
      return url.split("/").pop() || "file";
    }
  };

  const Icon = icon === "image" ? Image : FileText;
  const totalCount = files.length + existingUrls.length;
  const canAddMore = totalCount < maxFiles;

  const header = (
    <div className="request-file-zone__header">
      <span className="text-sm font-medium">{label} <span className="request-file-zone__count">({totalCount}/{maxFiles})</span></span>
      {attachmentsBelow && <span className="request-file-zone__hint">{hint}</span>}
    </div>
  );

  const attachments = (
    <>
      {existingUrls.length > 0 && (
        <div className="space-y-2">
          {existingUrls.map((url, index) => (
            <div key={`existing-${index}`} className="request-file-attachment flex min-w-0 items-start gap-2 rounded-lg border bg-muted/30 p-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <button type="button" onClick={() => openStoredFile(url)} className="request-file-attachment__name min-w-0 flex-1 text-left text-sm text-primary hover:underline">
                {getFileName(url)}
              </button>
              {onRemoveExisting && (
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={() => onRemoveExisting(url)} aria-label={`Удалить ${getFileName(url)}`}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={`new-${index}`} className="request-file-attachment flex min-w-0 items-start gap-2 rounded-lg border bg-muted/50 p-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="request-file-attachment__name min-w-0 flex-1 text-sm">{file.name}</span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(index)} aria-label={`Удалить ${file.name}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const dropZone = canAddMore ? (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Выбрать: ${label}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "request-file-zone__drop flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-all duration-200",
        isDragOver ? "scale-[1.02] border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <div className={cn("rounded-full p-2 transition-colors", isDragOver ? "bg-primary/10" : "bg-muted")}>
        <Upload className={cn("h-5 w-5 transition-colors", isDragOver ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{isDragOver ? "Отпустите для загрузки" : "Перетащите файлы сюда"}</p>
        <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("w-full min-w-0 space-y-2", attachmentsBelow && "request-file-zone")}>
      {header}
      <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} className="hidden" multiple />
      {!attachmentsBelow && attachments}
      {dropZone}
      {attachmentsBelow ? attachments : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};
