import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  const validateFile = (file: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    return file.size <= maxSize;
  };

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
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
    },
    [onFilesChange, files, existingUrls.length, maxFiles, maxSizeMB]
  );

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
    
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const getFileName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const parts = path.split('/');
      const fileName = parts[parts.length - 1];
      // Remove timestamp prefix if exists
      const match = fileName.match(/^(\d+)-(.*)$/);
      return match ? match[2] : fileName;
    } catch {
      return url.split('/').pop() || 'file';
    }
  };

  const Icon = icon === "image" ? Image : FileText;
  const totalCount = files.length + existingUrls.length;
  const canAddMore = totalCount < maxFiles;

  return (
    <div className="space-y-2 w-full min-w-0">
      <span className="text-sm font-medium">{label} ({totalCount}/{maxFiles})</span>
      
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        multiple
      />

      {/* Existing files */}
      {existingUrls.length > 0 && (
        <div className="space-y-2">
          {existingUrls.map((url, index) => (
            <div key={`existing-${index}`} className="flex min-w-0 items-center gap-2 p-3 border rounded-lg bg-muted/30">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm truncate flex-1 min-w-0 text-primary hover:underline"
              >
                {getFileName(url)}
              </a>
              {onRemoveExisting && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => onRemoveExisting(url)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={`new-${index}`} className="flex min-w-0 items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1 min-w-0">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => handleRemoveFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div
            className={cn(
              "p-2 rounded-full transition-colors",
              isDragOver ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "h-5 w-5 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragOver ? "Отпустите для загрузки" : "Перетащите файлы сюда"}
            </p>
            <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
};
