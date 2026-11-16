import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import {
  deleteRequestFile,
  getRequestFileRemovalPatch,
  requestFileName,
  type RequestDocumentKind,
  type RequestDocumentRecord,
} from "@/lib/requestDocuments";
import { cn } from "@/lib/utils";

interface RequestDocumentDeleteButtonProps {
  request: RequestDocumentRecord;
  url: string;
  kind?: RequestDocumentKind;
  readOnly?: boolean;
  className?: string;
  onDeleted?: (patch: Record<string, string[] | string | null>) => void;
}

export function RequestDocumentDeleteButton({
  request,
  url,
  kind = "document",
  readOnly,
  className,
  onDeleted,
}: RequestDocumentDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  if (readOnly) return null;

  const label = kind === "photo" ? "Удалить фото" : "Удалить документ";
  const name = requestFileName(url);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteRequestFile(request, url, kind);
      const patch = getRequestFileRemovalPatch(request, url, kind);
      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: unknown) =>
        Array.isArray(old) ? old.map((item) => item?.id === request.id ? { ...item, ...patch } : item) : old
      );
      queryClient.setQueryData(["request", request.id], (old: unknown) => old && typeof old === "object" ? { ...old, ...patch } : old);
      onDeleted?.(patch);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", request.id] }),
      ]);
      toast({ title: kind === "photo" ? "Фото удалено" : "Документ удалён", description: name });
      setOpen(false);
    } catch (error) {
      console.error("Request document delete:", error);
      toast({ title: "Не удалось удалить документ", description: "Заявка не изменена", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mt-2 block break-words font-medium text-foreground">{name}</span>
              <span className="mt-1 block">Файл будет отвязан от выбранной заявки и удалён из хранилища.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} disabled={deleting}>
              {deleting ? "Удаление…" : label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
