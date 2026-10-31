import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, MapPin, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { warehouseRows } from '@/lib/simpleWarehouse';
import { pluralRu } from '@/lib/pluralRu';
import { NO_OBJECT, filterIssues, issueDate, objectKey, orgRows, positionTotals, summarizeByObject, type IssueRow } from '@/lib/objectIssues';

interface Unit { id: string; name: string; unit: string; product_id: string | null; qr_token: string }
const fmtQty = (n: number) => Number(n.toFixed(3)).toLocaleString('ru-RU');
const fmtDate = (d: string) => d.split('-').reverse().join('.');

/** Posted issues grouped by CRM object. With `objectId` it shows only that object's card. */
export function ObjectIssuesView({ orgId, objectId: fixed }: { orgId: string; objectId?: string }) {
  const [selected, setSelected] = useState<string | null>(fixed ?? null);
  const [search, setSearch] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const { data, error, isLoading } = useQuery({
    queryKey: ['wh-qr', 'object-issues', orgId],
    queryFn: async () => {
      const [issues, units, objects, warehouses, equipment, products] = await Promise.all([
        warehouseRows<IssueRow>((f, t) => supabase.from('warehouse_issues').select('id,organization_id,unit_id,warehouse_id,recipient_name,request_id,object_id,equipment_id,operation_date,created_at,issued_qty,returned_qty').eq('organization_id', orgId).order('created_at', { ascending: false }).range(f, t)),
        warehouseRows<Unit>((f, t) => supabase.from('warehouse_units').select('id,name,unit,product_id,qr_token').eq('organization_id', orgId).order('id').range(f, t)),
        warehouseRows<{ id: string; name: string; address: string | null }>((f, t) => supabase.from('request_objects').select('id,name,address').eq('organization_id', orgId).order('name').range(f, t)),
        warehouseRows<{ id: string; name: string }>((f, t) => supabase.from('warehouses').select('id,name').eq('organization_id', orgId).order('id').range(f, t)),
        warehouseRows<{ id: string; model: string; plate_number: string | null }>((f, t) => supabase.from('equipment').select('id,model,plate_number').eq('organization_id', orgId).order('id').range(f, t)),
        warehouseRows<{ id: string; article: string | null }>((f, t) => supabase.from('warehouse_products').select('id,article').eq('organization_id', orgId).order('id').range(f, t)),
      ]);
      const reqIds = [...new Set(issues.flatMap(i => i.request_id ? [i.request_id] : []))];
      const requests = reqIds.length ? await warehouseRows<{ id: string; request_number: string | null; description: string | null }>((f, t) => supabase.from('requests').select('id,request_number,description').in('id', reqIds.slice(0, 500)).order('id').range(f, t)) : [];
      return { issues: orgRows(issues, orgId), units, objects, warehouses, equipment, products, requests };
    },
  });
  const summary = useMemo(() => summarizeByObject(data?.issues ?? []), [data]);

  if (isLoading) return <p>Загрузка выдач…</p>;
  if (error) return <p role="alert" className="text-destructive">Не удалось загрузить выдачи: {(error as Error).message}</p>;
  if (!data) return null;
  const unit = (id: string) => data.units.find(u => u.id === id);
  const eq = (id: string | null) => { const x = data.equipment.find(e => e.id === id); return x ? [x.plate_number, x.model].filter(Boolean).join(' • ') : ''; };
  const wh = (id: string) => data.warehouses.find(w => w.id === id)?.name ?? '—';
  const req = (id: string | null) => data.requests.find(r => r.id === id);
  const article = (id: string) => { const p = unit(id)?.product_id; return p ? data.products.find(x => x.id === p)?.article ?? '' : ''; };

  if (!selected) {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    const list = [...data.objects.map(o => ({ id: o.id, name: o.name, sub: o.address ?? '' })), ...(summary.has(NO_OBJECT) ? [{ id: NO_OBJECT, name: 'Без объекта (техника)', sub: 'Выдачи на технику без указания объекта' }] : [])]
      .filter(o => terms.every(t => `${o.name} ${o.sub}`.toLowerCase().includes(t)));
    return <div className="space-y-3">
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск объекта" aria-label="Поиск объекта" className="min-h-11" />
      {!data.objects.length && !summary.size ? <p className="text-muted-foreground py-6">Пока нет объектов и выдач</p> : !list.length ? <p className="text-muted-foreground py-6">Объекты не найдены</p> :
        <div className="divide-y border-y border-border">{list.map(o => { const s = summary.get(o.id); return <Button key={o.id} variant="ghost" className="w-full min-h-16 h-auto py-3 justify-start text-left whitespace-normal gap-3" onClick={() => setSelected(o.id)}>
          {o.id === NO_OBJECT ? <Truck className="h-5 w-5 shrink-0 text-muted-foreground" /> : <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />}
          <span className="flex-1 min-w-0"><span className="block font-medium break-words">{o.name}</span>{o.sub && <span className="block text-xs text-muted-foreground break-words">{o.sub}</span>}</span>
          <span className="text-xs text-muted-foreground text-right shrink-0 font-numeric">{s ? <>{s.positions} {pluralRu(s.positions, ['наименование', 'наименования', 'наименований'])}<br />{s.issues} {pluralRu(s.issues, ['выдача', 'выдачи', 'выдач'])}</> : 'Нет выдач'}</span>
          <ChevronRight className="h-4 w-4 shrink-0" /></Button>; })}</div>}
    </div>;
  }

  const objName = selected === NO_OBJECT ? 'Без объекта (техника)' : data.objects.find(o => o.id === selected)?.name ?? 'Объект';
  const own = data.issues.filter(r => objectKey(r) === selected);
  const text = (r: IssueRow) => `${unit(r.unit_id)?.name ?? ''} ${article(r.unit_id)} ${r.recipient_name} ${eq(r.equipment_id)} ${wh(r.warehouse_id)} ${req(r.request_id)?.description ?? ''}`;
  const rows = filterIssues(own, { from: from || undefined, to: to || undefined, search, text });
  const totals = positionTotals(own, data.units);
  const hasReturns = own.some(r => Number(r.returned_qty) > 0);
  return <div className="space-y-4">
    {!fixed && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="min-h-11" onClick={() => { setSelected(null); setSearch(''); }}><ArrowLeft className="h-4 w-4 mr-2" />Назад к объектам</Button><h2 className="text-lg font-semibold break-words min-w-0 flex-1">{objName}</h2></div>}
    {!own.length ? <p className="text-muted-foreground py-6">На этот объект пока ничего не выдавали</p> : <>
      <section className="space-y-2"><h3 className="text-sm font-medium">Что выдано</h3>
        <div className="divide-y border-y border-border">{totals.map(t => <div key={t.unitId} className="py-2 flex gap-3 items-start text-sm">
          <span className="flex-1 min-w-0"><span className="block font-medium break-words">{t.name}</span>{article(t.unitId) && <span className="block text-xs text-muted-foreground">Арт. {article(t.unitId)}</span>}</span>
          <span className="text-right font-numeric shrink-0">Выдано {fmtQty(t.issued)} {t.unit}{hasReturns && <><br /><span className="text-xs text-muted-foreground">Возвращено {fmtQty(t.returned)} · На объекте {fmtQty(t.onObject)} {t.unit}</span></>}</span></div>)}</div>
      </section>
      <section className="space-y-2"><h3 className="text-sm font-medium">История выдач</h3>
        <div className="flex flex-wrap gap-2"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск ТМЦ, получателя, техники" aria-label="Поиск по выдачам" className="min-h-11 flex-1 min-w-48" />
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="С даты" className="min-h-11 w-auto min-w-0" /><Input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="По дату" className="min-h-11 w-auto min-w-0" /></div>
        {!rows.length ? <p className="text-muted-foreground py-4">Выдачи не найдены</p> : <div className="divide-y border-y border-border">{rows.map(r => { const u = unit(r.unit_id); const q = req(r.request_id); return <div key={r.id} className="py-2 text-sm space-y-0.5">
          <div className="flex gap-2"><span className="flex-1 min-w-0 font-medium break-words">{u ? <Link className="underline-offset-2 hover:underline" to={`/warehouse?qr=${encodeURIComponent(u.qr_token)}`}>{u.name}</Link> : '—'}</span><span className="font-numeric shrink-0">{fmtQty(Number(r.issued_qty))} {u?.unit}</span></div>
          <div className="text-xs text-muted-foreground break-words">{fmtDate(issueDate(r))} · Кому: {r.recipient_name} · Со склада: {wh(r.warehouse_id)}{r.equipment_id && ` · Техника: ${eq(r.equipment_id) || '—'}`}{Number(r.returned_qty) > 0 && ` · Возвращено ${fmtQty(Number(r.returned_qty))}`}</div>
          {q && <Link className="text-xs underline-offset-2 hover:underline text-primary" to={`/requests?request=${q.id}`}>Заявка: {q.description || q.request_number}</Link>}
        </div>; })}</div>}
      </section></>}
  </div>;
}
