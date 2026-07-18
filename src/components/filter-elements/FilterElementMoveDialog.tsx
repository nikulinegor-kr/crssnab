import { useEffect, useState } from "react";
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
  currentLocation: string | null;
  currentStock: number;
}

export function FilterElementMoveDialog({
  open, onOpenChange, orgId, filterElementId, filterName, currentLocation, currentStock,
}: Props) {
  const qc = useQueryClient();
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [qty, setQty] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setFromLoc(currentLocation ?? "");
      setToLoc("");
      setQty(String(currentStock ?? ""));
      setComment("");
    }
  }, [open, currentLocation, currentStock]);

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || q <= 0) throw new Error("Количество должно быть больше 0");
      if (!toLoc.trim()) throw new Error("Укажите склад назначения");
      if (fromLoc.trim() && fromLoc.trim() === toLoc.trim()) {
        throw new Error("Склад назначения совпадает с исходным");
      }
      const { error } = await (supabase as any).from("filter_element_movements").insert({
        organization_id: orgId,
        filter_element_id: filterElementId,
        type: "MOVE",
        quantity: q,
        from_location: fromLoc.trim() || null,
        to_location: toLoc.trim(),
        comment: comment.trim() || null,
      });
      if (error) throw error;
      // Обновим место хранения фильтра
      await (supabase as any)
        .from("filter_elements")
        .update({ storage_location: toLoc.trim() })
        .eq("id", filterElementId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      qc.invalidateQueries({ queryKey: ["filter-element-movements"] });
      toast.success("Перемещение выполнено");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Перемещение — {filterName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Остаток: <span className="font-numeric">{currentStock}</span>
          </div>
          <div>
            <Label>Со склада</Label>
            <Input value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} placeholder="Текущее место хранения" />
          </div>
          <div>
            <Label>На склад *</Label>
            <Input value={toLoc} onChange={(e) => setToLoc(e.target.value)} placeholder="Новое место хранения" />
          </div>
          <div>
            <Label>Количество *</Label>
            <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Сохранение..." : "Переместить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
