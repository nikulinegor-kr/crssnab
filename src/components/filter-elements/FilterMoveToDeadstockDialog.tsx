import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { FilterElementRow } from "@/hooks/useFilterElements";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  item: FilterElementRow;
}

export function FilterMoveToDeadstockDialog({ open, onOpenChange, orgId, item }: Props) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(String(item.stock ?? 0));
  const [marketPrice, setMarketPrice] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || q <= 0) throw new Error("Количество обязательно");
      if (q > (item.stock ?? 0)) throw new Error("Количество больше остатка");
      const compatibility = (item.equipment ?? [])
        .map((e) => `${e.brand ?? ""} ${e.model ?? ""}`.trim())
        .filter(Boolean)
        .join(", ");
      // Insert into deadstock
      const { error: dsErr } = await (supabase as any).from("filter_element_deadstock").insert({
        organization_id: orgId,
        filter_element_id: item.id,
        manufacturer: item.manufacturer,
        name: item.name,
        article: item.article,
        cross_numbers: item.cross_numbers ?? [],
        compatibility: compatibility || null,
        quantity: q,
        unit: item.unit,
        market_price: marketPrice ? Number(marketPrice) : null,
        status: "for_sale",
        notes: notes.trim() || null,
      });
      if (dsErr) throw dsErr;
      // Subtract stock via WRITE_OFF movement
      const { error: mvErr } = await (supabase as any).from("filter_element_movements").insert({
        organization_id: orgId,
        filter_element_id: item.id,
        type: "WRITE_OFF",
        quantity: q,
        comment: "Перевод в неликвид" + (notes.trim() ? `: ${notes.trim()}` : ""),
      });
      if (mvErr) throw mvErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      qc.invalidateQueries({ queryKey: ["filter-element-deadstock"] });
      toast.success("Перенесено в неликвид");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>В неликвид — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Остаток: <span className="font-numeric">{item.stock ?? 0}</span></div>
          <div>
            <Label>Количество *</Label>
            <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Рыночная стоимость, ₽</Label>
            <Input type="number" step="any" value={marketPrice} onChange={(e) => setMarketPrice(e.target.value)} />
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Перенос..." : "Перенести"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
