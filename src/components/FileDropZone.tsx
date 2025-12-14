import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  label: string;
  hint: string;
  icon?: "image" | "document";
  maxSizeMB?: number;
}

export const FileDropZone = ({
  accept,
  file,
  onFileChange,
  label,
  hint,
  icon = "document",
  maxSizeMB = 10,
}: FileDropZoneProps) => {
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
    if (file.size > maxSize) {
      return false;
    }
    return true;
  };

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && validateFile(droppedFile)) {
        onFileChange(droppedFile);
      }
    },
    [onFileChange, maxSizeMB]
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      onFileChange(selectedFile);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const Icon = icon === "image" ? Image : FileText;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
      
      {file ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
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
              {isDragOver ? "Отпустите для загрузки" : "Перетащите файл сюда"}
            </p>
            <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
};
