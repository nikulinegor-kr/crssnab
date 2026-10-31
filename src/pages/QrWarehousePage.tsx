import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Camera, Plus, Printer, QrCode, ScanLine } from "lucide-react";
import { parseQrInput, DOC_TYPE_LABELS, type WarehouseDocType } from "@/lib/warehouseQr";
import { printLabels } from "@/lib/warehouseLabels";
import { CameraScanDialog } from "@/components/warehouse-qr/CameraScanDialog";
import { OperationDialog } from "@/components/warehouse-qr/OperationDialog";
import type { WhBalance, WhCell, WhIssue, WhUnit, WhWarehouse } from "@/components/warehouse-qr/types";

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const OP_LABELS: Record<string, string> = { receipt: "Приёмка", move_out: "Перемещение −", move_in: "Перемещение +", issue: "Выдача", return: "Возврат" };
const fmtDate = (d: string) => format(new Date(d), "dd.MM.yyyy HH:mm", { locale: ru });

export default function QrWarehousePage() {
  const { currentOrgId: orgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [camera, setCamera] = useState(false);
  const [card, setCard] = useState<{ kind: "cell"; cell: WhCell } | { kind: "unit"; unit: WhUnit } | null>(null);
  const [op, setOp] = useState<{ type: WarehouseDocType; unit: WhUnit; cellId?: string | null } | null>(null);
  const [newUnit, setNewUnit] = useState(false);
  const [newCell, setNewCell] = useState(false);
  const [search, setSearch] = useState("");

  const enabled = !!orgId;
  const { data: warehouses = [] } = useQuery({
    queryKey: ["wh-qr", "warehouses", orgId], enabled,
    queryFn: async () => (await supabase.from("warehouses").select("id, name").eq("organization_id", orgId!).order("name")).data as WhWarehouse[] ?? [],
  });
  const { data: cells = [] } = useQuery({
    queryKey: ["wh-qr", "cells", orgId], enabled,
    queryFn: () => fetchAll<WhCell>((f, t) => supabase.from("warehouse_cells").select("id, warehouse_id, code, description, qr_token, is_active").eq("organization_id", orgId!).order("code").range(f, t)),
  });
  const { data: units = [] } = useQuery({
    queryKey: ["wh-qr", "units", orgId], enabled,
    queryFn: () => fetchAll<WhUnit>((f, t) => supabase.from("warehouse_units").select("id, kind, name, serial_number, batch_number, unit, qr_token, product_id, created_at").eq("organization_id", orgId!).order("created_at", { ascending: false }).range(f, t)),
  });
  const { data: balances = [] } = useQuery({
    queryKey: ["wh-qr", "balances", orgId], enabled,
    queryFn: () => fetchAll<WhBalance>((f, t) => supabase.from("warehouse_balances").select("id, unit_id, warehouse_id, cell_id, quantity").eq("organization_id", orgId!).gt("quantity", 0).range(f, t)),
  });
  const { data: issues = [] } = useQuery({
    queryKey: ["wh-qr", "issues", orgId], enabled,
    queryFn: () => fetchAll<WhIssue>((f, t) => supabase.from("warehouse_issues").select("id, unit_id, warehouse_id, cell_id, recipient_name, issued_qty, returned_qty, request_id, object_id, created_at").eq("organization_id", orgId!).order("created_at", { ascending: false }).range(f, t)),
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["wh-qr", "documents", orgId], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouse_documents").select("id, doc_type, status, number, recipient_name, created_at, posted_at, warehouse_document_lines(unit_id, quantity)").eq("organization_id", orgId!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ["wh-qr", "ledger", orgId], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouse_ledger").select("id, unit_id, warehouse_id, cell_id, operation, delta, balance_after, created_at, document_id").eq("organization_id", orgId!).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const whName = useCallback((id: string | null) => warehouses.find((w) => w.id === id)?.name ?? "—", [warehouses]);
  const cellCode = useCallback((id: string | null) => (id ? cells.find((c) => c.id === id)?.code ?? "—" : "без ячейки"), [cells]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const openByCode = (raw: string) => {
    const parsed = parseQrInput(raw);
    if (!parsed) {
      toast({ title: "Код не распознан", description: "Ожидается QR склада CRSS", variant: "destructive" });
      return;
    }
    const cell = parsed.kind !== "unit" ? cells.find((c) => c.qr_token === parsed.token) : undefined;
    const unit = parsed.kind !== "cell" ? units.find((u) => u.qr_token === parsed.token) : undefined;
    if (cell) setCard({ kind: "cell", cell });
    else if (unit) setCard({ kind: "unit", unit });
    else toast({ title: "Не найдено в вашей организации", variant: "destructive" });
  };

  const unitLabel = (u: WhUnit) => ({
    kind: "unit" as const, token: u.qr_token, title: u.name,
    lines: [u.kind === "item" ? (u.serial_number ? `S/N ${u.serial_number}` : "Изделие") : `Партия ${u.batch_number ?? "—"} · ${u.unit}`],
  });
  const cellLabel = (c: WhCell) => ({ kind: "cell" as const, token: c.qr_token, title: `Ячейка ${c.code}`, lines: [whName(c.warehouse_id), c.description ?? ""] });

  const q = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (s: string) => q.every((t) => s.toLowerCase().includes(t));
  const filteredUnits = units.filter((u) => match(`${u.name} ${u.serial_number ?? ""} ${u.batch_number ?? ""}`));
  const stockRows = balances
    .map((b) => ({ b, u: unitById.get(b.unit_id) }))
    .filter((r) => r.u && match(`${r.u.name} ${r.u.serial_number ?? ""} ${r.u.batch_number ?? ""} ${cellCode(r.b.cell_id)}`));

  const postDraft = async (id: string) => {
    if (!window.confirm("Провести документ? После проведения его нельзя изменить.")) return;
    const { data, error } = await supabase.rpc("post_warehouse_document", { _document_id: id });
    if (error) toast({ title: "Не проведено", description: error.message, variant: "destructive" });
    else toast({ title: `Проведено: ${(data as { number?: string })?.number ?? ""}` });
    qc.invalidateQueries({ queryKey: ["wh-qr"] });
  };
  const deleteDraft = async (id: string) => {
    const { error } = await supabase.from("warehouse_documents").delete().eq("id", id).eq("status", "draft");
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["wh-qr"] });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/warehouse")}><ArrowLeft className="h-4 w-4 mr-1" />Склад</Button>
        <h1 className="text-xl font-semibold">Адресное хранение и QR</h1>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); openByCode(scan); setScan(""); }}
      >
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input ref={scanRef} autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Отсканируйте QR сканером или введите код" className="pl-9 h-11" aria-label="Код QR" />
        </div>
        <Button type="submit" className="h-11">Открыть</Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setCamera(true)} aria-label="Сканировать камерой"><Camera className="h-4 w-4" /></Button>
      </form>

      <Tabs defaultValue="stock">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="stock">Остатки</TabsTrigger>
            <TabsTrigger value="units">Изделия и партии</TabsTrigger>
            <TabsTrigger value="cells">Ячейки</TabsTrigger>
            <TabsTrigger value="issues">Выдачи</TabsTrigger>
            <TabsTrigger value="docs">Документы</TabsTrigger>
            <TabsTrigger value="ledger">Журнал</TabsTrigger>
          </TabsList>
        </div>
        <div className="mt-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск" className="max-w-sm" />
        </div>

        <TabsContent value="stock">
          <Table>
            <TableHeader><TableRow><TableHead>Позиция</TableHead><TableHead>Склад</TableHead><TableHead>Ячейка</TableHead><TableHead className="text-right">Остаток</TableHead></TableRow></TableHeader>
            <TableBody>
              {stockRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Остатков нет</TableCell></TableRow>}
              {stockRows.map(({ b, u }) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setCard({ kind: "unit", unit: u! })}>
                  <TableCell>{u!.name} <span className="text-xs text-muted-foreground">{u!.kind === "item" ? u!.serial_number ?? "" : u!.batch_number ?? ""}</span></TableCell>
                  <TableCell>{whName(b.warehouse_id)}</TableCell>
                  <TableCell>{cellCode(b.cell_id)}</TableCell>
                  <TableCell className="text-right font-numeric">{Number(b.quantity)} {u!.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="units" className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setNewUnit(true)}><Plus className="h-4 w-4 mr-1" />Изделие или партия</Button>
            <Button size="sm" variant="outline" disabled={filteredUnits.length === 0} onClick={() => printLabels(filteredUnits.slice(0, 200).map(unitLabel))}><Printer className="h-4 w-4 mr-1" />Печать списка</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Наименование</TableHead><TableHead>Тип</TableHead><TableHead>S/N / партия</TableHead><TableHead className="text-right">На складе</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filteredUnits.map((u) => {
                const total = balances.filter((b) => b.unit_id === u.id).reduce((s, b) => s + Number(b.quantity), 0);
                return (
                  <TableRow key={u.id} className="cursor-pointer" onClick={() => setCard({ kind: "unit", unit: u })}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell><Badge variant="outline">{u.kind === "item" ? "Изделие" : "Партия"}</Badge></TableCell>
                    <TableCell>{(u.kind === "item" ? u.serial_number : u.batch_number) ?? "—"}</TableCell>
                    <TableCell className="text-right font-numeric">{total} {u.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); printLabels([unitLabel(u)]); }} aria-label="Печать этикетки"><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="cells" className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setNewCell(true)} disabled={warehouses.length === 0}><Plus className="h-4 w-4 mr-1" />Ячейка</Button>
            <Button size="sm" variant="outline" disabled={cells.length === 0} onClick={() => printLabels(cells.filter((c) => match(c.code)).slice(0, 300).map(cellLabel))}><Printer className="h-4 w-4 mr-1" />Печать ячеек</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Код</TableHead><TableHead>Склад</TableHead><TableHead className="text-right">Позиций</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {cells.filter((c) => match(`${c.code} ${whName(c.warehouse_id)}`)).map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setCard({ kind: "cell", cell: c })}>
                  <TableCell className="font-medium">{c.code}{!c.is_active && <Badge variant="secondary" className="ml-2">неактивна</Badge>}</TableCell>
                  <TableCell>{whName(c.warehouse_id)}</TableCell>
                  <TableCell className="text-right font-numeric">{balances.filter((b) => b.cell_id === c.id).length}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); printLabels([cellLabel(c)]); }} aria-label="Печать этикетки"><Printer className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="issues">
          <Table>
            <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Позиция</TableHead><TableHead>Получатель</TableHead><TableHead className="text-right">Выдано / возвращено</TableHead></TableRow></TableHeader>
            <TableBody>
              {issues.filter((i) => match(`${unitById.get(i.unit_id)?.name ?? ""} ${i.recipient_name}`)).map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => { const u = unitById.get(i.unit_id); if (u) setCard({ kind: "unit", unit: u }); }}>
                  <TableCell className="font-numeric">{fmtDate(i.created_at)}</TableCell>
                  <TableCell>{unitById.get(i.unit_id)?.name ?? "—"}</TableCell>
                  <TableCell>{i.recipient_name}</TableCell>
                  <TableCell className="text-right font-numeric">{Number(i.issued_qty)} / {Number(i.returned_qty)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="docs">
          <Table>
            <TableHeader><TableRow><TableHead>Номер</TableHead><TableHead>Тип</TableHead><TableHead>Статус</TableHead><TableHead>Позиции</TableHead><TableHead>Создан</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-numeric">{d.number ?? "—"}</TableCell>
                  <TableCell>{DOC_TYPE_LABELS[d.doc_type as WarehouseDocType]}</TableCell>
                  <TableCell><Badge variant={d.status === "posted" ? "default" : "secondary"}>{d.status === "posted" ? "Проведён" : "Черновик"}</Badge></TableCell>
                  <TableCell className="text-sm">{(d.warehouse_document_lines ?? []).map((l) => `${unitById.get(l.unit_id)?.name ?? "?"} × ${Number(l.quantity)}`).join("; ")}</TableCell>
                  <TableCell className="font-numeric">{fmtDate(d.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {d.status === "draft" && (
                      <>
                        <Button size="sm" onClick={() => postDraft(d.id)}>Провести</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteDraft(d.id)}>Удалить</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="ledger">
          <Table>
            <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Операция</TableHead><TableHead>Позиция</TableHead><TableHead>Место</TableHead><TableHead className="text-right">Изменение</TableHead><TableHead className="text-right">Остаток</TableHead></TableRow></TableHeader>
            <TableBody>
              {ledger.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-numeric">{fmtDate(l.created_at)}</TableCell>
                  <TableCell>{OP_LABELS[l.operation] ?? l.operation}</TableCell>
                  <TableCell>{unitById.get(l.unit_id)?.name ?? "—"}</TableCell>
                  <TableCell>{whName(l.warehouse_id)} · {cellCode(l.cell_id)}</TableCell>
                  <TableCell className="text-right font-numeric">{Number(l.delta) > 0 ? "+" : ""}{Number(l.delta)}</TableCell>
                  <TableCell className="text-right font-numeric">{Number(l.balance_after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <CameraScanDialog open={camera} onOpenChange={setCamera} onResult={openByCode} />

      <Dialog open={!!card} onOpenChange={(v) => { if (!v) { setCard(null); setTimeout(() => scanRef.current?.focus(), 50); } }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {card?.kind === "unit" && (() => {
            const u = card.unit;
            const bs = balances.filter((b) => b.unit_id === u.id);
            const open = issues.filter((i) => i.unit_id === u.id && Number(i.returned_qty) < Number(i.issued_qty));
            const total = bs.reduce((s, b) => s + Number(b.quantity), 0);
            return (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />{u.name}</DialogTitle></DialogHeader>
                <div className="text-sm space-y-2">
                  <p className="text-muted-foreground">{u.kind === "item" ? `Изделие · S/N ${u.serial_number ?? "—"}` : `Партия ${u.batch_number ?? "—"} · ${u.unit}`}</p>
                  <p>На складе: <span className="font-numeric font-medium">{total} {u.unit}</span></p>
                  {bs.map((b) => <p key={b.id} className="text-xs">{whName(b.warehouse_id)} · {cellCode(b.cell_id)} — <span className="font-numeric">{Number(b.quantity)}</span></p>)}
                  {open.length > 0 && <p className="text-xs">Выдано: {open.map((i) => `${i.recipient_name} (${Number(i.issued_qty) - Number(i.returned_qty)})`).join(", ")}</p>}
                </div>
                <DialogFooter className="flex-wrap gap-2 sm:justify-start">
                  <Button variant="outline" onClick={() => setOp({ type: "receipt", unit: u })} disabled={u.kind === "item" && (total > 0 || open.length > 0)}>Принять</Button>
                  <Button variant="outline" onClick={() => setOp({ type: "move", unit: u })} disabled={total === 0}>Переместить</Button>
                  <Button variant="outline" onClick={() => setOp({ type: "issue", unit: u })} disabled={total === 0}>Выдать</Button>
                  <Button variant="outline" onClick={() => setOp({ type: "return", unit: u })} disabled={open.length === 0}>Вернуть</Button>
                  <Button variant="ghost" onClick={() => printLabels([unitLabel(u)])}><Printer className="h-4 w-4 mr-1" />Этикетка</Button>
                </DialogFooter>
              </>
            );
          })()}
          {card?.kind === "cell" && (() => {
            const c = card.cell;
            const bs = balances.filter((b) => b.cell_id === c.id);
            return (
              <>
                <DialogHeader><DialogTitle>Ячейка {c.code} · {whName(c.warehouse_id)}</DialogTitle></DialogHeader>
                {bs.length === 0 ? <p className="text-sm text-muted-foreground">Ячейка пуста</p> : (
                  <div className="space-y-1">
                    {bs.map((b) => { const u = unitById.get(b.unit_id); return u && (
                      <button key={b.id} className="w-full text-left text-sm flex justify-between rounded-md px-2 py-2 hover:bg-muted min-h-[44px] items-center" onClick={() => setCard({ kind: "unit", unit: u })}>
                        <span>{u.name}</span><span className="font-numeric">{Number(b.quantity)} {u.unit}</span>
                      </button>); })}
                  </div>
                )}
                <DialogFooter><Button variant="ghost" onClick={() => printLabels([cellLabel(c)])}><Printer className="h-4 w-4 mr-1" />Этикетка ячейки</Button></DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {orgId && (
        <OperationDialog
          open={!!op} onOpenChange={(v) => !v && setOp(null)} orgId={orgId} type={op?.type ?? "receipt"} unit={op?.unit ?? null}
          warehouses={warehouses} cells={cells} balances={balances} issues={issues}
          defaultCellId={card?.kind === "cell" ? card.cell.id : null}
        />
      )}
      {orgId && <NewUnitDialog open={newUnit} onOpenChange={setNewUnit} orgId={orgId} onCreated={(u) => { qc.invalidateQueries({ queryKey: ["wh-qr"] }); setCard({ kind: "unit", unit: u }); }} />}
      {orgId && <NewCellDialog open={newCell} onOpenChange={setNewCell} orgId={orgId} warehouses={warehouses} />}
    </div>
  );
}

function NewUnitDialog({ open, onOpenChange, orgId, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; orgId: string; onCreated: (u: WhUnit) => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"item" | "batch">("item");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("шт");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const n = kind === "item" ? Math.min(Math.max(parseInt(count) || 1, 1), 200) : 1;
    const rows = Array.from({ length: n }, (_, i) => ({
      organization_id: orgId, kind, name: name.trim(), unit: kind === "item" ? "шт" : unit.trim() || "шт",
      serial_number: kind === "item" ? (n > 1 && code ? `${code}-${i + 1}` : code || null) : null,
      batch_number: kind === "batch" ? code || null : null,
    }));
    const { data, error } = await supabase.from("warehouse_units").insert(rows).select("id, kind, name, serial_number, batch_number, unit, qr_token, product_id, created_at");
    setBusy(false);
    if (error) return toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    toast({ title: n > 1 ? `Создано ${n} изделий с отдельными QR` : "Создано" });
    if (n > 1) printLabels((data as WhUnit[]).map((u) => ({ kind: "unit", token: u.qr_token, title: u.name, lines: [u.serial_number ? `S/N ${u.serial_number}` : "Изделие"] })));
    setName(""); setCode(""); setCount("1");
    onOpenChange(false);
    onCreated((data as WhUnit[])[0]);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Новая учётная единица</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={kind} onValueChange={(v) => setKind(v as "item" | "batch")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="item">Изделие — уникальный QR на каждую штуку</SelectItem>
              <SelectItem value="batch">Материал — партия по количеству</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1"><Label>Наименование *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>{kind === "item" ? "Серийный номер" : "Номер партии"}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          {kind === "batch" ? (
            <div className="space-y-1"><Label>Единица</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
          ) : (
            <div className="space-y-1"><Label>Сколько изделий создать</Label><Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className="font-numeric" /></div>
          )}
          <p className="text-xs text-muted-foreground">Остаток появится только после проведения приёмки.</p>
        </div>
        <DialogFooter><Button disabled={busy || !name.trim()} onClick={save}>Создать</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCellDialog({ open, onOpenChange, orgId, warehouses }: { open: boolean; onOpenChange: (v: boolean) => void; orgId: string; warehouses: WhWarehouse[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wh, setWh] = useState("");
  const [codes, setCodes] = useState("");
  const save = async () => {
    const list = Array.from(new Set(codes.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)));
    const { error } = await supabase.from("warehouse_cells").insert(list.map((code) => ({ organization_id: orgId, warehouse_id: wh, code })));
    if (error) return toast({ title: "Ошибка", description: error.message.includes("duplicate") ? "Такая ячейка уже есть на складе" : error.message, variant: "destructive" });
    toast({ title: `Добавлено ячеек: ${list.length}` });
    setCodes("");
    qc.invalidateQueries({ queryKey: ["wh-qr"] });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ячейки хранения</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={wh} onValueChange={setWh}>
            <SelectTrigger><SelectValue placeholder="Склад" /></SelectTrigger>
            <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="space-y-1"><Label>Коды ячеек (через запятую или с новой строки)</Label><Input value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="A-01-01, A-01-02" /></div>
        </div>
        <DialogFooter><Button disabled={!wh || !codes.trim()} onClick={save}>Добавить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
