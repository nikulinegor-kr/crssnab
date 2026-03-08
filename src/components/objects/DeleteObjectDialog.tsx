import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteObjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectId: string;
  objectName: string;
  requestCount: number;
  availableObjects: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

export const DeleteObjectDialog = ({
  open,
  onOpenChange,
  objectId,
  objectName,
  requestCount,
  availableObjects,
  onSuccess,
}: DeleteObjectDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"transfer" | "delete-all" | null>(null);
  const [targetObjectId, setTargetObjectId] = useState("");

  const otherObjects = availableObjects.filter((o) => o.id !== objectId);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (requestCount > 0 && action === "transfer" && targetObjectId) {
        // Transfer requests to another object
        const { error: transferError } = await supabase
          .from("requests")
          .update({ object_id: targetObjectId })
          .eq("object_id", objectId);
        if (transferError) throw transferError;
      } else if (requestCount > 0 && action === "delete-all") {
        // Remove object_id from requests (unlink), then delete
        const { error: unlinkError } = await supabase
          .from("requests")
          .update({ object_id: null })
          .eq("object_id", objectId);
        if (unlinkError) throw unlinkError;
      }

      // Delete object documents
      await supabase.from("object_documents").delete().eq("object_id", objectId);

      // Delete the object itself
      const { error } = await supabase.from("request_objects").delete().eq("id", objectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      queryClient.invalidateQueries({ queryKey: ["request-objects-all"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      onOpenChange(false);
      setAction(null);
      setTargetObjectId("");
      toast({ title: "Объект удалён" });
      onSuccess?.();
    },
    onError: () => toast({ title: "Ошибка при удалении", variant: "destructive" }),
  });

  const canSubmit = requestCount === 0 || action === "delete-all" || (action === "transfer" && targetObjectId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setAction(null); setTargetObjectId(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Удалить объект
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить объект «{objectName}»?
          </DialogDescription>
        </DialogHeader>

        {requestCount > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              В объекте есть <strong>{requestCount}</strong> заявок. Что сделать?
            </p>

            <div className="space-y-2">
              <Button
                variant={action === "transfer" ? "default" : "outline"}
                className="w-full justify-start"
                size="sm"
                onClick={() => setAction("transfer")}
              >
                Перенести заявки в другой объект
              </Button>

              {action === "transfer" && (
                <Select value={targetObjectId} onValueChange={setTargetObjectId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите объект" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherObjects.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                    {otherObjects.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Нет других объектов</div>
                    )}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant={action === "delete-all" ? "destructive" : "outline"}
                className="w-full justify-start"
                size="sm"
                onClick={() => setAction("delete-all")}
              >
                Удалить вместе с заявками
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            У объекта нет заявок. Он будет удалён безвозвратно.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={!canSubmit || deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
