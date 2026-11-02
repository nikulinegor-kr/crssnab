import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, MapPin, Truck, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { warehouseRows } from '@/lib/simpleWarehouse';
import { fmtQty, issueGroup, issueSplit, totalsByUnit, type IssueGroup } from '@/lib/issueStatus';
import { IssueActionsDialog, type ActionIssue } from './IssueActionsDialog';

const GROUPS: [IssueGroup, string][] = [['object', 'Объекты'], ['equipment', 'Техника'], ['employee', 'Сотрудники']];
const SELECT = 'id,organization_id,unit_id,warehouse_id,recipient_name,recipient_user_id,equipment_id,object_id,operation_date,created_at,issued_qty,returned_qty,installed_qty,consumed_qty,note,received_confirmed_at,received_confirmed_proxy';

async function inChunks<T>(ids: string[], load: (chunk: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await load(ids.slice(i, i + 200)); if (error) throw error; out.push(...((data ?? []) as T[])); }
  return out;
}

/** "Выдано": objects / equipment / employees with search, current "числится" apart from issued history. */
export function IssuedView({ orgId }: { orgId: string }) {
  const [group, setGroup] = useState<IssueGroup>('object');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [onlyOpen, setOnlyOpen] = useState(true);
  const [action, setAction] = useState<ActionIssue | null>(null);
  const { data, error, isLoading } = useQuery({ queryKey: ['wh-qr', 'issued', orgId], queryFn: async () => {
    const issues = await warehouseRows<ActionIssue>((f, t) => supabase.from('warehouse_issues').select(SELECT).eq('organization_id', orgId).order('created_at', { ascending: false }).range(f, t));
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
    const [units, objects, equipment, people] = await Promise.all([
      inChunks<{ id: string; name: string; unit: string }>(uniq(issues.map(i => i.unit_id)), c => supabase.from('warehouse_units').select('id,name,unit').in('id', c)),
      inChunks<{ id: string; name: string }>(uniq(issues.map(i => i.object_id)), c => supabase.from('request_objects').select('id,name').in('id', c)),
      inChunks<{ id: string; model: string; plate_number: string | null }>(uniq(issues.map(i => i.equipment_id)), c => supabase.from('equipment').select('id,model,plate_number').in('id', c)),
      inChunks<{ id: string; full_name: string | null }>(uniq(issues.map(i => i.recipient_user_id)), c => supabase.from('profiles').select('id,full_name').in('id', c)),
    ]);
    return { issues, units, objects, equipment, people };
  } });
  const unitOf = (id: string) => data?.units.find(u => u.id === id);
  const groupName = (g: IssueGroup, id: string, sample?: ActionIssue) => g === 'object' ? data?.objects.find(o => o.id === id)?.name ?? 'Объект'
    : g === 'equipment' ? (() => { const e = data?.equipment.find(x => x.id === id); return e ? [e.plate_number, e.model].filter(Boolean).join(' • ') : 'Техника'; })()
    : data?.people.find(p => p.id === id)?.full_name ?? sample?.recipient_name ?? 'Без сотрудника';
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; rows: ActionIssue[] }>();
    for (const i of data?.issues ?? []) { const k = issueGroup(i); if (k.group !== group) continue; const g = m.get(k.id) ?? { id: k.id, rows: [] }; g.rows.push(i); m.set(k.id, g); }
    return [...m.values()];
  }, [data, group]);
  if (isLoading) return <p>Загрузка выдач…</p>;
  if (error) return <p role="alert" className="text-destructive">Не удалось загрузить выдачи: {(error as Error).message}</p>;
  if (!data) return null;
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const Icon = group === 'object' ? MapPin : group === 'equipment' ? Truck : User;
  const dialog = <IssueActionsDialog orgId={orgId} open={!!action} onOpenChange={v => { if (!v) setAction(null); }} issue={action} unitName={action ? unitOf(action.unit_id)?.name ?? '—' : ''} unit={action ? unitOf(action.unit_id)?.unit ?? '' : ''} />;

  if (!selected) {
    const list = groups.map(g => ({ ...g, name: groupName(group, g.id, g.rows[0]) })).filter(g => terms.every(t => `${g.name} ${g.rows.map(r => unitOf(r.unit_id)?.name ?? '').join(' ')}`.toLowerCase().includes(t))).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{GROUPS.map(([k, t]) => <Button key={k} variant={group === k ? 'secondary' : 'ghost'} className="min-h-11" onClick={() => setGroup(k)}>{t}</Button>)}</div>
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или ТМЦ" aria-label="Поиск выдач" className="min-h-11" />
      {!list.length ? <p className="text-muted-foreground py-6">Выдач нет</p> : <div className="divide-y border-y border-border">{list.map(g => { const totals = totalsByUnit(g.rows.map(r => ({ unit: unitOf(r.unit_id)?.unit ?? '', split: issueSplit(r) }))); return <Button key={g.id} variant="ghost" className="w-full min-h-16 h-auto py-3 justify-start text-left whitespace-normal gap-3" onClick={() => setSelected(g.id)}>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="flex-1 min-w-0"><span className="block font-medium break-words">{g.name}</span><span className="block text-xs text-muted-foreground font-numeric">Числится: {totals.map(t => `${fmtQty(t.outstanding)} ${t.unit}`).join(', ')}</span></span>
        <span className="text-xs text-muted-foreground shrink-0">{g.rows.length} выд.</span><ChevronRight className="h-4 w-4 shrink-0" /></Button>; })}</div>}
      {dialog}
    </div>;
  }
  const own = groups.find(g => g.id === selected)?.rows ?? [];
  const date = (r: ActionIssue) => r.operation_date ?? r.created_at.slice(0, 10);
  const rows = own.filter(r => (!from || date(r) >= from) && (!to || date(r) <= to) && (!onlyOpen || issueSplit(r).outstanding > 0) && terms.every(t => `${unitOf(r.unit_id)?.name ?? ''} ${r.recipient_name}`.toLowerCase().includes(t)));
  const totals = totalsByUnit(own.map(r => ({ unit: unitOf(r.unit_id)?.unit ?? '', split: issueSplit(r) })));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="min-h-11" onClick={() => { setSelected(null); setSearch(''); }}><ArrowLeft className="h-4 w-4 mr-2" />Назад</Button><h2 className="text-lg font-semibold break-words min-w-0 flex-1">{groupName(group, selected, own[0])}</h2></div>
    <div className="text-sm font-numeric space-y-0.5">{totals.map(t => <p key={t.unit}>Исторически выдано {fmtQty(t.issued)} {t.unit} · <b>Числится {fmtQty(t.outstanding)} {t.unit}</b> · Установлено {fmtQty(t.installed)} · Израсходовано {fmtQty(t.consumed)} · Возвращено {fmtQty(t.returned)}</p>)}</div>
    <div className="flex flex-wrap gap-2"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск ТМЦ или получателя" aria-label="Поиск по выдачам" className="min-h-11 flex-1 min-w-48" />
      <Input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="С даты" className="min-h-11 w-auto" /><Input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="По дату" className="min-h-11 w-auto" />
      <Button variant={onlyOpen ? 'secondary' : 'ghost'} className="min-h-11" onClick={() => setOnlyOpen(v => !v)}>{onlyOpen ? 'Только числится' : 'Вся история'}</Button></div>
    {!rows.length ? <p className="text-muted-foreground py-4">Ничего не найдено</p> : <div className="divide-y border-y border-border">{rows.map(r => { const u = unitOf(r.unit_id); const s = issueSplit(r); return <div key={r.id} className="py-2 flex gap-2 items-start text-sm">
      <div className="flex-1 min-w-0 space-y-0.5"><p className="font-medium break-words">{u?.name ?? '—'}</p><p className="text-xs text-muted-foreground break-words">{date(r).split('-').reverse().join('.')} · Кому: {r.recipient_name}{r.received_confirmed_at ? ' · Получил ✓' : ' · Не подтверждено'}</p>
        <p className="text-xs font-numeric">Выдано {fmtQty(s.issued)} · Числится {fmtQty(s.outstanding)}{s.installed ? ` · Установлено ${fmtQty(s.installed)}` : ''}{s.consumed ? ` · Израсходовано ${fmtQty(s.consumed)}` : ''}{s.returned ? ` · Возвращено ${fmtQty(s.returned)}` : ''} {u?.unit}</p></div>
      <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setAction(r)}>Действия</Button></div>; })}</div>}
    {dialog}
  </div>;
}
