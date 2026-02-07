import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { sold_at: string; buyer: string; invoice_number: string; tk?: string; shipped_at?: string; arrived_at?: string }) => void;
  isPending: boolean;
}

export function DeadstockSoldDialog({ open, onOpenChange, onConfirm, isPending }: Props) {
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [buyer, setBuyer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tk, setTk] = useState("");
  const [shippedAt, setShippedAt] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");

  const canSubmit = soldAt && buyer.trim() && invoiceNumber.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({
      sold_at: soldAt,
      buyer: buyer.trim(),
      invoice_number: invoiceNumber.trim(),
      tk: tk.trim() || undefined,
      shipped_at: shippedAt || undefined,
      arrived_at: arrivedAt || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Продажа неликвида</DialogTitle>
          <DialogDescription>Заполните данные о продаже</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Дата продажи *</Label>
            <Input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} className="min-w-0" />
          </div>
          <div>
            <Label>Покупатель *</Label>
            <Input value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="Название покупателя" />
          </div>
          <div>
            <Label>Номер счета *</Label>
            <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Номер счета" />
          </div>
          <div>
            <Label>ТК</Label>
            <Input value={tk} onChange={e => setTk(e.target.value)} placeholder="Транспортная компания" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Дата отгрузки</Label>
              <Input type="date" value={shippedAt} onChange={e => setShippedAt(e.target.value)} className="min-w-0" />
            </div>
            <div>
              <Label>Дата прихода</Label>
              <Input type="date" value={arrivedAt} onChange={e => setArrivedAt(e.target.value)} className="min-w-0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Сохранение..." : "Подтвердить продажу"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
