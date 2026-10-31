import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { WhUnit, WhWarehouse } from './types';

type Kind = 'all' | 'move' | 'issue' | 'receipt';
const LABEL: Record<string, string> = { receipt: 'Приёмка', move: 'Перемещение', issue: 'Выдача', return: 'Возврат' };

interface Row { id: number; document_id: string; line_id: string | null; unit_id: string; warehouse_id: string; operation: string; delta: number; created_at: string; created_by: string | null }
interface Doc { id: string; recipient_name: string | null; object_id: string | null; equipment_id: string | null; operation_date: string | null }

export interface JournalEntry { id: string; kind: string; at: string; unit_id: string; qty: number; from?: string; to?: string; recipient?: string | null; target?: string; author: string }

/** Folds raw ledger rows into one entry per operation line (move_out + move_in → one move). */
export function foldLedger(rows: Row[], docs: Doc[], whName: (id: string) => string, targetName: (d: Doc) => string | undefined, author: (id: string | null) => string): JournalEntry[] {
  const out: JournalEntry[] = []; const moves = new Map<string, JournalEntry>();
  for (const r of rows) {
    const d = docs.find(x => x.id === r.document_id);
    if (r.operation === 'move_out' || r.operation === 'move_in') {
      const k = `${r.document_id}:${r.line_id}`; let e = moves.get(k);
      if (!e) { e = { id: k, kind: 'move', at: r.created_at, unit_id: r.unit_id, qty: Math.abs(Number(r.delta)), author: author(r.created_by) }; moves.set(k, e); out.push(e); }
      if (r.operation === 'move_out') e.from = whName(r.warehouse_id); else e.to = whName(r.warehouse_id);
    } else {
      out.push({ id: String(r.id), kind: r.operation, at: r.created_at, unit_id: r.unit_id, qty: Math.abs(Number(r.delta)), from: r.operation === 'issue' ? whName(r.warehouse_id) : undefined, to: r.operation !== 'issue' ? whName(r.warehouse_id) : undefined, recipient: r.operation === 'issue' ? d?.recipient_name : undefined, target: r.operation === 'issue' && d ? targetName(d) : undefined, author: author(r.created_by) });
    }
  }
  return out;
}

export function WarehouseJournal({ orgId, units, warehouses, unitId }: { orgId: string; units: WhUnit[]; warehouses: WhWarehouse[]; unitId?: string }) {
  const [kind, setKind] = useState<Kind>('all'); const [search, setSearch] = useState(''); const [limit, setLimit] = useState(100);
  const { data, error, isLoading } = useQuery({
    queryKey: ['wh-qr', 'journal', orgId, unitId ?? 'all', limit],
    queryFn: async () => {
      let q = supabase.from('warehouse_ledger').select('id,document_id,line_id,unit_id,warehouse_id,operation,delta,created_at,created_by').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(limit * 2);
      if (unitId) q = q.eq('unit_id', unitId);
      const { data: rows, error } = await q; if (error) throw error;
      const docIds = [...new Set((rows ?? []).map(r => r.document_id))];
      const { data: docs, error: de } = docIds.length ? await supabase.from('warehouse_documents').select('id,recipient_name,object_id,equipment_id,operation_date').in('id', docIds) : { data: [], error: null };
      if (de) throw de;
      const objIds = [...new Set((docs ?? []).flatMap(d => d.object_id ? [d.object_id] : []))];
      const eqIds = [...new Set((docs ?? []).flatMap(d => d.equipment_id ? [d.equipment_id] : []))];
      const userIds = [...new Set((rows ?? []).flatMap(r => r.created_by ? [r.created_by] : []))];
      const [o, e, p] = await Promise.all([
        objIds.length ? supabase.from('request_objects').select('id,name').in('id', objIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        eqIds.length ? supabase.from('equipment').select('id,model,plate_number').in('id', eqIds) : Promise.resolve({ data: [] as { id: string; model: string; plate_number: string | null }[] }),
        userIds.length ? supabase.from('profiles').select('id,full_name').in('id', userIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      ]);
      return { rows: (rows ?? []) as Row[], docs: (docs ?? []) as Doc[], objects: o.data ?? [], equipment: e.data ?? [], profiles: p.data ?? [] };
    },
  });
  const entries = useMemo(() => {
    if (!data) return [];
    const wh = (id: string) => warehouses.find(w => w.id === id)?.name ?? '—';
    const target = (d: Doc) => d.object_id ? `Объект: ${data.objects.find(o => o.id === d.object_id)?.name ?? '—'}` : d.equipment_id ? (() => { const x = data.equipment.find(q => q.id === d.equipment_id); return `Техника: ${[x?.plate_number, x?.model].filter(Boolean).join(' • ') || '—'}`; })() : undefined;
    const who = (id: string | null) => data.profiles.find(p => p.id === id)?.full_name ?? '—';
    return foldLedger(data.rows, data.docs, wh, target, who);
  }, [data, warehouses]);
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = entries.filter(e => (kind === 'all' || e.kind === kind) && terms.every(t => `${units.find(u => u.id === e.unit_id)?.name ?? ''} ${e.recipient ?? ''} ${e.target ?? ''} ${e.from ?? ''} ${e.to ?? ''} ${e.author}`.toLowerCase().includes(t)));
  return <div className="space-y-3 min-w-0">
    {!unitId && <div className="flex flex-wrap gap-2">
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ТМЦ, получателю, объекту" aria-label="Поиск в журнале" className="min-h-11 flex-1 min-w-0" />
      {(['all', 'move', 'issue', 'receipt'] as Kind[]).map(k => <Button key={k} variant={kind === k ? 'default' : 'outline'} className="min-h-11" onClick={() => setKind(k)}>{k === 'all' ? 'Все' : k === 'move' ? 'Перемещения' : k === 'issue' ? 'Выдачи' : 'Приёмки'}</Button>)}
    </div>}
    {error ? <p role="alert" className="text-destructive">Не удалось загрузить журнал: {(error as Error).message}</p> : isLoading ? <p>Загрузка журнала…</p> : !shown.length ? <p className="text-muted-foreground py-4">Операций пока нет</p> :
      <div className="divide-y border-y border-border">{shown.map(e => { const u = units.find(x => x.id === e.unit_id); return <div key={e.id} className="py-3 space-y-1 min-w-0">
        <div className="flex justify-between gap-3"><span className="font-medium">{LABEL[e.kind] ?? e.kind}{!unitId && <> · <span className="break-words">{u?.name ?? '—'}</span></>}</span><span className="font-numeric shrink-0">{e.qty} {u?.unit ?? ''}</span></div>
        <p className="text-sm break-words">{e.kind === 'move' ? `${e.from ?? '—'} → ${e.to ?? '—'}` : e.kind === 'issue' ? [e.from, e.recipient && `Кому: ${e.recipient}`, e.target].filter(Boolean).join(' · ') : e.to}</p>
        <p className="text-xs text-muted-foreground">{e.author} · {new Date(e.at).toLocaleString('ru-RU')}</p>
      </div>; })}</div>}
    {!unitId && data && data.rows.length >= limit * 2 && <Button variant="outline" className="min-h-11" onClick={() => setLimit(n => n + 100)}>Показать ещё</Button>}
  </div>;
}
