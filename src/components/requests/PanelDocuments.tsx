import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type DocKind = "photo" | "document";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const PHOTO_LIMIT = 5 * 1024 * 1024;
const DOC_LIMIT = 10 * 1024 * 1024;
const MAX_FILES = 10;

export const detectKind = (file: File): DocKind => (file.type.startsWith("image/") ? "photo" : "document");

export const validateFile = (file: File): string | null => {
  const kind = detectKind(file);
  if (kind === "photo") {
    if (!PHOTO_TYPES.includes(file.type)) return "Формат не поддерживается. Нужен JPG, PNG или WEBP.";
    if (file.size > PHOTO_LIMIT) return "Фото больше 5 МБ. Сожмите изображение и повторите.";
  } else {
    if (!DOC_TYPES.includes(file.type)) return "Формат не поддерживается. Нужен PDF, DOC или XLS.";
    if (file.size > DOC_LIMIT) return "Документ больше 10 МБ. Уменьшите файл и повторите.";
  }
  return null;
};

const sanitize = (name: string) => {
  const cleaned = name.replace(/[^\w.\-]+/g, "_");
  return cleaned || `file_${Date.now()}`;
};

const humanSize = (bytes?: number | null) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} МБ` : "—";

export interface UploadTask {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

interface PanelDocumentsProps {
  requestId: string;
  requestNumber: string;
  photoUrls: string[];
  documentUrls: string[];
  readOnly?: boolean;
  uploads: UploadTask[];
  onUpload: (files: File[]) => void;
}

const fileNameFromUrl = (url: string) => decodeURIComponent(url.split("/").pop() || "Файл");

/** Фото и документы заявки: загрузка, просмотр, скачивание, удаление. */
export const PanelDocuments = ({
  requestId,
  requestNumber,
  photoUrls,
  documentUrls,
  readOnly,
  uploads,
  onUpload,
}: PanelDocumentsProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<{ url: string; kind: DocKind } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta] = useState<Record<string, { size?: number; created_at?: string }>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<string, { size?: number; created_at?: string }> = {};
      for (const bucket of ["request-photos", "request-documents"]) {
        const { data } = await supabase.storage.from(bucket).list(requestNumber, { limit: 100 });
        (data || []).forEach((f) => {
          next[f.name] = { size: (f.metadata as any)?.size, created_at: f.created_at ?? undefined };
        });
      }
      if (!cancelled) setMeta(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [requestNumber, photoUrls.length, documentUrls.length]);

  const remove = async () => {
    if (!pendingDelete) return;
    const { url, kind } = pendingDelete;
    setDeleting(true);
    try {
      const column = kind === "photo" ? "photo_urls" : "document_urls";
      const list = (kind === "photo" ? photoUrls : documentUrls).filter((u) => u !== url);
      const { error } = await supabase.from("requests").update({ [column]: list }).eq("id", requestId);
      if (error) throw error;
      const bucket = kind === "photo" ? "request-photos" : "request-documents";
      const path = url.split(`/${bucket}/`)[1];
      if (path) await supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Файл удалён" });
    } catch (e) {
      console.error("doc delete:", e);
      toast({ title: "Не удалось удалить файл", variant: "destructive" });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const pick = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    onUpload(Array.from(files).slice(0, MAX_FILES));
  }, [onUpload]);

  const Section = ({ title, kind, urls }: { title: string; kind: DocKind; urls: string[] }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {title} {urls.length ? urls.length : ""}
        </span>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => (kind === "photo" ? photoInput : docInput).current?.click()}
          >
            <Upload className="h-3 w-3" />
            Выбрать файлы
          </Button>
        )}
      </div>

      {!readOnly && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files);
          }}
          className="rounded border border-dashed border-border px-2 py-2 text-center text-[10px] text-muted-foreground"
        >
          Перетащите файлы сюда
        </div>
      )}

      {urls.length === 0 && <div className="text-[11px] text-muted-foreground">—</div>}

      {urls.map((url) => {
        const name = fileNameFromUrl(url);
        const info = meta[name];
        return (
          <div key={url} className="flex items-center gap-2 border-b border-border/70 py-1.5">
            {kind === "photo" ? (
              <img src={url} alt={name} loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px]">{name}</div>
              <div className="font-numeric text-[9.5px] text-muted-foreground">
                {humanSize(info?.size)}
                {info?.created_at ? ` • ${new Date(info.created_at).toLocaleDateString("ru-RU")}` : ""}
              </div>
            </div>
            <a href={url} target="_blank" rel="noreferrer" aria-label="Открыть" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href={url} download aria-label="Скачать" className="text-muted-foreground hover:text-primary">
              <Download className="h-3.5 w-3.5" />
            </a>
            {!readOnly && (
              <button
                type="button"
                aria-label="Удалить"
                onClick={() => setPendingDelete({ url, kind })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <input
        ref={photoInput}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={docInput}
        type="file"
        accept={DOC_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />

      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u) => (
            <div key={u.id} className={cn("rounded border px-2 py-1", u.error ? "border-destructive/60" : "border-border")}>
              <div className="flex items-center gap-2 text-[10.5px]">
                {!u.error && u.progress < 100 && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="font-numeric text-[9.5px] text-muted-foreground">{u.error ? "" : `${u.progress}%`}</span>
              </div>
              {u.error ? (
                <div className="text-[9.5px] text-destructive">{u.error}</div>
              ) : (
                <div className="mt-1 h-1 w-full rounded bg-muted">
                  <div className="h-1 rounded bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Section title="Фото" kind="photo" urls={photoUrls} />
      <Section title="Документы" kind="document" urls={documentUrls} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>Файл будет удалён из заявки без возможности вернуть.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const uploadHelpers = { sanitize, MAX_FILES };
