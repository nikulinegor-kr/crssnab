import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DOC_TYPE_LABELS, validateOperation, type WarehouseDocType } from "@/lib/warehouseQr";
import type { WhBalance, WhCell, WhIssue, WhUnit, WhWarehouse } from "./types";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  type: WarehouseDocType;
  unit: WhUnit | null;
  warehouses: WhWarehouse[];
  cells: WhCell[];
  balances: WhBalance[];
  issues: WhIssue[];
  defaultCellId?: string | null;
}

export function OperationDialog({ open, onOpenChange, orgId, type, unit, warehouses, cells, balances, issues, defaultCellId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");
  const [source, setSource] = useState<string>("");
  const [toWh, setToWh] = useState<string>("");
  const [toCell, setToCell] = useState<string>(NONE);
  const [recipient, setRecipient] = useState("");
  const [requestId, setRequestId] = useState<string>(NONE);
  const [objectId, setObjectId] = useState<string>(NONE);
  const [issueId, setIssueId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const unitBalances = useMemo(() => balances.filter((b) => b.unit_id === unit?.id && Number(b.quantity) > 0), [balances, unit]);
  const unitIssues = useMemo(() => issues.filter((i) => i.unit_id === unit?.id && Number(i.returned_qty) < Number(i.issued_qty)), [issues, unit]);

  useEffect(() => {
    if (!open) return;
    setQty("1"); setRecipient(""); setRequestId(NONE); setObjectId(NONE); setComment(""); setConfirming(false); setRequestQuery("");
    const preferred = unitBalances.find((b) => b.cell_id === defaultCellId) ?? unitBalances[0];
    setSource(preferred?.id ?? "");
    const cell = cells.find((c) => c.id === defaultCellId);
    setToWh(cell?.warehouse_id ?? warehouses[0]?.id ?? "");
    setToCell(type === "receipt" && cell ? cell.id : NONE);
    setIssueId(unitIssues[0]?.id ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: requests = [] } = useQuery({
    queryKey: ["wh-qr-requests", orgId, requestQuery],
    enabled: open && type === "issue",
    queryFn: async () => {
      let q = supabase.from("requests").select("id, request_number, description").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20);
      const t = requestQuery.trim();
      if (t) q = q.or(`request_number.ilike.%${t.replace(/[%,()]/g, "")}%,description.ilike.%${t.replace(/[%,()]/g, "")}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: objects = [] } = useQuery({
    queryKey: ["wh-qr-objects", orgId],
    enabled: open && type === "issue",
    queryFn: async () => {
      const { data, error } = await supabase.from("request_objects").select("id, name").eq("organization_id", orgId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!unit) return null;
  const src = unitBalances.find((b) => b.id === source);
  const iss = unitIssues.find((i) => i.id === issueId);
  const quantity = Number(qty.replace(",", "."));
  const draft = {
    type, kind: unit.kind, quantity,
    available: src ? Number(src.quantity) : undefined,
    returnable: iss ? Number(iss.issued_qty) - Number(iss.returned_qty) : undefined,
    fromWarehouseId: src?.warehouse_id ?? null, fromCellId: src?.cell_id ?? null,
    toWarehouseId: type === "return" ? iss?.warehouse_id ?? null : toWh || null,
    toCellId: type === "return" ? iss?.cell_id ?? null : toCell === NONE ? null : toCell,
    recipientName: recipient, requestId: requestId === NONE ? null : requestId, objectId: objectId === NONE ? null : objectId,
    issueId: issueId || null,
  };
  const errors = validateOperation(draft);
  const placeLabel = (wh?: string | null, cell?: string | null) =>
    [warehouses.find((w) => w.id === wh)?.name ?? "—", cell ? cells.find((c) => c.id === cell)?.code : "без ячейки"].join(" · ");
  const targetCells = cells.filter((c) => c.warehouse_id === toWh && c.is_active);

  const run = async (post: boolean) => {
    setBusy(true);
    try {
      const { data: doc, error } = await supabase.from("warehouse_documents").insert({
        organization_id: orgId, doc_type: type, comment: comment || null,
        recipient_name: type === "issue" ? recipient.trim() : null,
        request_id: type === "issue" ? draft.requestId : null, object_id: type === "issue" ? draft.objectId : null,
      }).select("id").single();
      if (error) throw error;
      const { error: le } = await supabase.from("warehouse_document_lines").insert({
        organization_id: orgId, document_id: doc.id, unit_id: unit.id, quantity,
        from_warehouse_id: type === "move" || type === "issue" ? draft.fromWarehouseId : null,
        from_cell_id: type === "move" || type === "issue" ? draft.fromCellId : null,
        to_warehouse_id: type === "receipt" || type === "move" ? draft.toWarehouseId : null,
        to_cell_id: type === "receipt" || type === "move" ? draft.toCellId : null,
        issue_id: type === "return" ? draft.issueId : null,
      });
      if (le) throw le;
      if (post) {
        const { data: res, error: pe } = await supabase.rpc("post_warehouse_document", { _document_id: doc.id });
        if (pe) throw pe;
        toast({ title: `Проведено: ${(res as { number?: string })?.number ?? ""}` });
      } else toast({ title: "Черновик сохранён" });
      qc.invalidateQueries({ queryKey: ["wh-qr"] });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Операция не выполнена", description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DOC_TYPE_LABELS[type]}: {unit.name}</DialogTitle>
        </DialogHeader>
        {!confirming ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {unit.kind === "item" ? `Изделие${unit.serial_number ? ` · S/N ${unit.serial_number}` : ""}` : `Партия${unit.batch_number ? ` ${unit.batch_number}` : ""} · ${unit.unit}`}
            </p>
            {(type === "move" || type === "issue") && (
              <div className="space-y-1">
                <Label>Откуда</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue placeholder="Нет остатка" /></SelectTrigger>
                  <SelectContent>
                    {unitBalances.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{placeLabel(b.warehouse_id, b.cell_id)} — {Number(b.quantity)} {unit.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {type === "return" && (
              <div className="space-y-1">
                <Label>Выдача</Label>
                <Select value={issueId} onValueChange={setIssueId}>
                  <SelectTrigger><SelectValue placeholder="Нет открытых выдач" /></SelectTrigger>
                  <SelectContent>
                    {unitIssues.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.recipient_name} — выдано {Number(i.issued_qty)}, возвращено {Number(i.returned_qty)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {iss && <p className="text-xs text-muted-foreground">Вернётся в: {placeLabel(iss.warehouse_id, iss.cell_id)}</p>}
              </div>
            )}
            {(type === "receipt" || type === "move") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Склад</Label>
                  <Select value={toWh} onValueChange={(v) => { setToWh(v); setToCell(NONE); }}>
                    <SelectTrigger><SelectValue placeholder="Склад" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Ячейка</Label>
                  <Select value={toCell} onValueChange={setToCell}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Без ячейки</SelectItem>
                      {targetCells.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {type === "issue" && (
              <>
                <div className="space-y-1">
                  <Label>Получатель *</Label>
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="ФИО" />
                </div>
                <div className="space-y-1">
                  <Label>Заявка</Label>
                  <Input value={requestQuery} onChange={(e) => setRequestQuery(e.target.value)} placeholder="Поиск по номеру или описанию" />
                  <Select value={requestId} onValueChange={setRequestId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {requests.map((r) => <SelectItem key={r.id} value={r.id}>{(r.request_number ?? "").replace(/^REQ-/, "")} · {(r.description ?? "").slice(0, 60)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Объект</Label>
                  <Select value={objectId} onValueChange={setObjectId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Количество, {unit.unit}</Label>
              <Input inputMode="decimal" value={qty} disabled={unit.kind === "item"} onChange={(e) => setQty(e.target.value)} className="font-numeric" />
            </div>
            <div className="space-y-1">
              <Label>Комментарий</Label>
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            {errors.length > 0 && <ul className="text-xs text-destructive list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Проверьте операцию перед проведением:</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Операция</dt><dd>{DOC_TYPE_LABELS[type]}</dd>
              <dt className="text-muted-foreground">Позиция</dt><dd>{unit.name}</dd>
              <dt className="text-muted-foreground">Количество</dt><dd className="font-numeric">{quantity} {unit.unit}</dd>
              {(type === "move" || type === "issue") && <><dt className="text-muted-foreground">Откуда</dt><dd>{placeLabel(draft.fromWarehouseId, draft.fromCellId)}</dd></>}
              {type !== "issue" && <><dt className="text-muted-foreground">Куда</dt><dd>{placeLabel(draft.toWarehouseId, draft.toCellId)}</dd></>}
              {type === "issue" && <><dt className="text-muted-foreground">Получатель</dt><dd>{recipient}</dd></>}
            </dl>
            <p className="text-xs text-muted-foreground">После проведения документ нельзя изменить; исправление — обратной операцией.</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          {!confirming ? (
            <>
              <Button variant="outline" disabled={busy || errors.length > 0} onClick={() => run(false)}>Сохранить черновик</Button>
              <Button disabled={busy || errors.length > 0} onClick={() => setConfirming(true)}>Далее</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Назад</Button>
              <Button disabled={busy} onClick={() => run(true)}>{busy ? "Проведение…" : "Подтвердить и провести"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
