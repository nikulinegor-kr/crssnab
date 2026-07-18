import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxQuantity: number;
  onConfirm: (data: { buyer: string; sold_at: string; quantity: number; actual_sale_price: number | null; sale_comment: string | null }) => void;
  isPending?: boolean;
}

export function FilterDeadstockSaleDialog({ open, onOpenChange, maxQuantity, onConfirm, isPending }: Props) {
  const [buyer, setBuyer] = useState("");
  const [soldAt, setSoldAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState(String(maxQuantity || 1));
  const [price, setPrice] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBuyer(""); setSoldAt(new Date().toISOString().slice(0, 10));
      setQty(String(maxQuantity || 1)); setPrice(""); setComment(""); setError(null);
    }
  }, [open, maxQuantity]);

  const submit = () => {
    setError(null);
    const q = Number(qty);
    if (!buyer.trim()) return setError("Укажите покупателя");
    if (!soldAt) return setError("Укажите дату продажи");
    if (!q || q <= 0) return setError("Количество должно быть больше 0");
    if (q > maxQuantity) return setError(`Максимум ${maxQuantity}`);
    onConfirm({
      buyer: buyer.trim(),
      sold_at: new Date(soldAt).toISOString(),
      quantity: q,
      actual_sale_price: price ? Number(price) : null,
      sale_comment: comment.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Продажа неликвида</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Покупатель *</Label>
            <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Дата продажи *</Label>
              <Input type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
            </div>
            <div>
              <Label>Количество * (макс. {maxQuantity})</Label>
              <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Фактическая стоимость продажи, ₽</Label>
            <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={isPending}>{isPending ? "Сохранение..." : "Продать"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
