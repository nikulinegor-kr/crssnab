import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { parseQrInput } from '@/lib/warehouseQr';
import { fmtQty } from '@/lib/issueStatus';
import type { WhUnit } from './types';

type Line = { id: string; unit_id: string; expected_qty: number; counted_qty: number | null; reason: string | null };
type Inv = { id: string; status: string; snapshot_at: string };

/** Inventory inside one warehouse: snapshot → scan/search → actual → reasons → explicit adjustment. Draft never changes stock. */
export function InventoryDialog({ open, onOpenChange, warehouseId, warehouseName, units }: { open: boolean; onOpenChange: (v: boolean) => void; warehouseId: string; warehouseName: string; units: WhUnit[] }) {
  const { toast } = useToast(); const qc = useQueryClient();
  const [search, setSearch] = useState(''), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [stale, setStale] = useState(false);
  const [draft, setDraft] = useState<Record<string, { counted: string; reason: string }>>({});
  const { data, refetch, isLoading, error } = useQuery({ queryKey: ['wh-qr', 'inventory', warehouseId], enabled: open, queryFn: async () => {
    const { data: inv, error } = await supabase.from('warehouse_inventories').select('id,status,snapshot_at').eq('warehouse_id', warehouseId).eq('status', 'draft').maybeSingle();
    if (error) throw error; if (!inv) return { inv: null as Inv | null, lines: [] as Line[] };
    const { data: lines, error: le } = await supabase.from('warehouse_inventory_lines').select('id,unit_id,expected_qty,counted_qty,reason').eq('inventory_id', inv.id).order('id').limit(2000);
    if (le) throw le; return { inv: inv as Inv, lines: (lines ?? []) as Line[] };
  } });
  useEffect(() => { if (data) { setDraft(Object.fromEntries(data.lines.map(l => [l.unit_id, { counted: l.counted_qty == null ? '' : String(l.counted_qty), reason: l.reason ?? '' }]))); setConfirm(false); } }, [data]);
  useEffect(() => { if (open) setStale(false); }, [open]);
  const unit = (id: string) => units.find(u => u.id === id);
  const lines = data?.lines ?? [];
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => lines.filter(l => terms.every(t => `${unit(l.unit_id)?.name ?? ''} ${unit(l.unit_id)?.batch_number ?? ''}`.toLowerCase().includes(t))), [lines, search, units]); // eslint-disable-line react-hooks/exhaustive-deps
  const fail = (e: unknown) => { const m = (e as { message?: string })?.message ?? String(e); if (/пересчитайте/.test(m)) setStale(true); toast({ title: 'Не выполнено', description: m, variant: 'destructive' }); };
  const call = async (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => { setBusy(true); try { const { error } = await fn(); if (error) throw error; await refetch(); if (ok) toast({ title: ok }); return true; } catch (e) { fail(e); return false; } finally { setBusy(false); } };
  const start = () => call(() => supabase.rpc('start_warehouse_inventory', { _warehouse_id: warehouseId }), 'Снимок остатков сделан');
  const saveLine = (unitId: string) => { const d = draft[unitId]; if (!data?.inv || !d) return; const n = d.counted.trim() === '' ? null : Number(d.counted.replace(',', '.')); if (n !== null && (!Number.isFinite(n) || n < 0)) { toast({ title: 'Неверное количество', variant: 'destructive' }); return; } void call(() => supabase.rpc('set_inventory_count', { _inventory_id: data.inv!.id, _unit_id: unitId, _counted: n as number, _reason: d.reason })); };
  const scan = async (raw: string) => {
    const code = parseQrInput(raw); const u = code ? units.find(x => x.qr_token === code.token) : units.find(x => x.name.toLowerCase() === raw.trim().toLowerCase());
    if (!u || !data?.inv) { toast({ title: 'ТМЦ не найдена', variant: 'destructive' }); return; }
    if (!lines.some(l => l.unit_id === u.id)) await call(() => supabase.rpc('set_inventory_count', { _inventory_id: data.inv!.id, _unit_id: u.id, _counted: null as unknown as number, _reason: '' }));
    setSearch(u.name);
  };
  const counted = lines.filter(l => l.counted_qty != null);
  const diffs = counted.filter(l => Number(l.counted_qty) !== Number(l.expected_qty));
  const missingReason = diffs.some(l => !(l.reason ?? '').trim());
  const post = async () => { if (!data?.inv) return; if (await call(() => supabase.rpc('post_warehouse_inventory', { _inventory_id: data.inv!.id, _confirm: confirm }), 'Инвентаризация проведена')) { await qc.invalidateQueries({ queryKey: ['wh-qr'] }); onOpenChange(false); } };
  return <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}><DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>Инвентаризация · {warehouseName}</DialogTitle></DialogHeader>
    {isLoading ? <p>Загрузка…</p> : error ? <p role="alert" className="text-destructive">{(error as Error).message}</p> : !data?.inv ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Будет сделан снимок текущих остатков. Пока пересчёт не проведён, остатки не меняются.</p><Button className="min-h-11" disabled={busy} onClick={start}>Начать инвентаризацию</Button></div> : <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Снимок: {format(new Date(data.inv.snapshot_at), 'dd.MM.yyyy HH:mm')} · Просчитано {counted.length} из {lines.length} · Непросчитанные позиции не меняются</p>
      {stale && <div role="alert" className="text-sm text-destructive space-y-2"><p>После снимка были движения по складу. Обновите снимок: изменившиеся позиции нужно пересчитать.</p><Button variant="outline" className="min-h-11" disabled={busy} onClick={async () => { if (await call(() => supabase.rpc('refresh_warehouse_inventory', { _inventory_id: data.inv!.id }), 'Снимок обновлён')) setStale(false); }}>Обновить снимок</Button></div>}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const v = (new FormData(e.currentTarget).get('code') as string) ?? ''; if (v.trim()) void scan(v); e.currentTarget.reset(); }}><Input name="code" placeholder="Скан QR ТМЦ" aria-label="Скан QR для инвентаризации" className="min-h-11 flex-1" /><Button type="submit" variant="outline" className="min-h-11">Найти</Button></form>
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск позиции" aria-label="Поиск позиции" className="min-h-11" />
      <div className="divide-y border-y border-border">{shown.slice(0, 200).map(l => { const u = unit(l.unit_id); const d = draft[l.unit_id] ?? { counted: '', reason: '' }; const diff = d.counted !== '' && Number(d.counted.replace(',', '.')) !== Number(l.expected_qty); return <div key={l.id} className="py-2 space-y-1">
        <div className="flex gap-2 items-center"><span className="flex-1 min-w-0 text-sm font-medium break-words">{u?.name ?? '—'}</span><span className="text-xs text-muted-foreground font-numeric shrink-0">учёт {fmtQty(Number(l.expected_qty))} {u?.unit}</span>
          <Input inputMode="decimal" aria-label={`Факт: ${u?.name}`} placeholder="Факт" className="w-24 min-h-11 font-numeric" value={d.counted} onChange={e => setDraft(o => ({ ...o, [l.unit_id]: { ...d, counted: e.target.value } }))} onBlur={() => saveLine(l.unit_id)} /></div>
        {diff && <Input placeholder="Причина расхождения *" aria-label={`Причина: ${u?.name}`} className="min-h-11" value={d.reason} onChange={e => setDraft(o => ({ ...o, [l.unit_id]: { ...d, reason: e.target.value } }))} onBlur={() => saveLine(l.unit_id)} />}
      </div>; })}</div>
      {diffs.length > 0 && <div className="text-sm space-y-1"><p className="font-medium">Расхождения: {diffs.length}</p>{diffs.map(l => <p key={l.id} className="font-numeric">{unit(l.unit_id)?.name}: {fmtQty(Number(l.expected_qty))} → {fmtQty(Number(l.counted_qty))} ({Number(l.counted_qty) > Number(l.expected_qty) ? '+' : ''}{fmtQty(Number(l.counted_qty) - Number(l.expected_qty))})</p>)}
        <label className="flex items-start gap-2"><Checkbox checked={confirm} onCheckedChange={v => setConfirm(v === true)} className="mt-0.5" /><span>Подтверждаю корректировку остатков по расхождениям</span></label></div>}
      <div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={busy || !counted.length || missingReason || (diffs.length > 0 && !confirm)} onClick={post}>Провести пересчёт</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={async () => { if (await call(() => supabase.rpc('cancel_warehouse_inventory', { _inventory_id: data.inv!.id }), 'Инвентаризация отменена')) onOpenChange(false); }}>Отменить черновик</Button></div>
      {missingReason && <p className="text-xs text-destructive">Укажите причину каждого расхождения</p>}
    </div>}
  </DialogContent></Dialog>;
}
