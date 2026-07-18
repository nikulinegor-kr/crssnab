import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQty(""); setComment(""); setUnitPrice(""); setSupplier("");
      setDocumentNumber(""); setReceiptDate(new Date().toISOString().slice(0, 10));
      setRequestId(null); setRequestSearch("");
    }
  }, [open]);

  const { data: requests = [] } = useQuery({
    queryKey: ["filter-mov-request-search", orgId, requestSearch],
    queryFn: async () => {
      if (!orgId) return [] as any[];
      let q = (supabase as any)
        .from("requests")
        .select("id, request_number, description, contractor, amount, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      const s = requestSearch.trim();
      if (s) q = q.or(`description.ilike.%${s}%,contractor.ilike.%${s}%,request_number.ilike.%${s}%`);
      const { data } = await q;
      return (data ?? []) as any[];
    },
    enabled: open && type === "IN",
  });

  const selectedRequest = useMemo(
    () => (requests as any[]).find((r) => r.id === requestId) ?? null,
    [requests, requestId],
  );

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || Number.isNaN(q)) throw new Error("Количество обязательно");
      const price = unitPrice.trim() ? Number(unitPrice) : null;
      if (type === "IN" && price != null && (Number.isNaN(price) || price < 0)) {
        throw new Error("Цена закупки должна быть неотрицательным числом");
      }
      const payload: any = {
        organization_id: orgId,
        filter_element_id: filterElementId,
        type,
        quantity: q,
        comment: comment.trim() || null,
      };
      if (type === "IN") {
        payload.unit_price = price;
        payload.supplier = supplier.trim() || null;
        payload.request_id = requestId;
        payload.document_number = documentNumber.trim() || null;
        payload.receipt_date = receiptDate ? new Date(receiptDate).toISOString() : null;
      }
      const { error } = await (supabase as any).from("filter_element_movements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      qc.invalidateQueries({ queryKey: ["filter-element-movements"] });
      toast.success("Операция проведена");
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Количество *</Label>
              <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            {type === "IN" && (
              <div>
                <Label>Цена закупки за ед.</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="₽"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          {type === "IN" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Поставщик</Label>
                  <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Наименование поставщика" />
                </div>
                <div>
                  <Label>Дата поступления</Label>
                  <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Номер УПД / накладной</Label>
                  <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Заявка (необязательно)</Label>
                <Popover open={requestOpen} onOpenChange={setRequestOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {selectedRequest
                        ? `${selectedRequest.description ?? "Без названия"}${selectedRequest.contractor ? ` — ${selectedRequest.contractor}` : ""}`
                        : "Выбрать заявку..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-2" align="start">
                    <Input
                      placeholder="Поиск: описание, контрагент, №"
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {requestId && (
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 rounded"
                          onClick={() => { setRequestId(null); setRequestOpen(false); }}
                        >
                          × Очистить выбор
                        </button>
                      )}
                      {(requests as any[]).length === 0 && (
                        <div className="text-sm text-muted-foreground p-2">Ничего не найдено</div>
                      )}
                      {(requests as any[]).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 hover:bg-accent/50 rounded text-sm"
                          onClick={() => { setRequestId(r.id); setRequestOpen(false); }}
                        >
                          <div className="font-medium truncate">{r.description ?? "Без названия"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.contractor ?? "—"}{r.amount ? ` • ${Number(r.amount).toLocaleString("ru-RU")} ₽` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {type === "ADJUST" && (
            <div className="text-xs text-muted-foreground">Отрицательное значение — уменьшить остаток.</div>
          )}

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
