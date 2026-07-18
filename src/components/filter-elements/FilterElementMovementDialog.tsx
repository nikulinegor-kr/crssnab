import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  filterElementId: string;
  filterName: string;
  type: "IN" | "ADJUST" | "RETURN";
}

const LABELS: Record<Props["type"], string> = {
  IN: "Пополнить",
  ADJUST: "Корректировка",
  RETURN: "Возврат",
};

export function FilterElementMovementDialog({ open, onOpenChange, orgId, filterElementId, filterName, type }: Props) {
  const qc = useQueryClient();
  const [qty, setQty] = useState("");
  const [comment, setComment] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || Number.isNaN(q)) throw new Error("Количество обязательно");
      const { error } = await (supabase as any).from("filter_element_movements").insert({
        organization_id: orgId,
        filter_element_id: filterElementId,
        type,
        quantity: q,
        comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      qc.invalidateQueries({ queryKey: ["filter-element-movements"] });
      toast.success("Операция проведена");
      setQty(""); setComment("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{LABELS[type]} — {filterName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Количество *</Label>
            <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            {type === "ADJUST" && (
              <div className="text-xs text-muted-foreground mt-1">Отрицательное значение — уменьшить остаток.</div>
            )}
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Сохранение..." : "Провести"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
