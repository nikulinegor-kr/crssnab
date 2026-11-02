import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { warehouseRows } from '@/lib/simpleWarehouse';
import { fmtQty, issueSplit } from '@/lib/issueStatus';

export interface ActionIssue { id: string; organization_id: string; unit_id: string; warehouse_id: string; recipient_name: string; recipient_user_id: string | null; equipment_id: string | null; object_id: string | null; operation_date: string | null; created_at: string; issued_qty: number; returned_qty: number; installed_qty: number; consumed_qty: number; note: string | null; received_confirmed_at: string | null; received_confirmed_proxy: boolean }
type Mode = 'return' | 'install' | 'consume';
type Hist = { id: string; kind: string; quantity: number; created_at: string; operation_date?: string; condition?: string; note: string | null; reason: string | null; reversal_of: string | null; warehouse_id?: string };

/** Return / install / consume / confirm receipt for one posted issue, plus linked corrections with a reason. */
export function IssueActionsDialog({ issue, unitName, unit, orgId, open, onOpenChange, initial = 'return' }: { issue: ActionIssue | null; unitName: string; unit: string; orgId: string; open: boolean; onOpenChange: (v: boolean) => void; initial?: Mode }) {
  const { toast } = useToast(); const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(initial);
  const [qty, setQty] = useState(''), [wh, setWh] = useState<string | null>(null), [cond, setCond] = useState<'good' | 'damaged'>('good');
  const [eq, setEq] = useState<string | null>(null), [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd')), [note, setNote] = useState('');
  const [key, setKey] = useState(''), [busy, setBusy] = useState(false), [reverse, setReverse] = useState<Hist | null>(null), [reason, setReason] = useState('');
  useEffect(() => { if (open && issue) { setMode(initial); setQty(''); setWh(issue.warehouse_id); setCond('good'); setEq(issue.equipment_id); setDate(format(new Date(), 'yyyy-MM-dd')); setNote(''); setKey(crypto.randomUUID()); setReverse(null); } }, [open, issue, initial]);
  const { data: me } = useQuery({ queryKey: ['auth-user'], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const { data: refs } = useQuery({ queryKey: ['wh-issue-refs', orgId], enabled: open, queryFn: async () => ({
    warehouses: await warehouseRows<{ id: string; name: string; archived_at: string | null }>((f, t) => supabase.from('warehouses').select('id,name,archived_at').eq('organization_id', orgId).order('name').range(f, t)),
    equipment: await warehouseRows<{ id: string; model: string; plate_number: string | null; brand: string }>((f, t) => supabase.from('equipment').select('id,model,plate_number,brand').eq('organization_id', orgId).order('model').range(f, t)),
  }) });
  const { data: hist = [] } = useQuery({ queryKey: ['wh-qr', 'issue-history', issue?.id], enabled: open && !!issue, queryFn: async () => {
    const [u, r] = await Promise.all([supabase.from('warehouse_issue_usages').select('id,kind,quantity,created_at,operation_date,note,reason,reversal_of').eq('issue_id', issue?.id ?? ''), supabase.from('warehouse_issue_returns').select('id,quantity,created_at,condition,note,reason,reversal_of,warehouse_id').eq('issue_id', issue?.id ?? '')]);
    if (u.error) throw u.error; if (r.error) throw r.error;
    return [...(u.data ?? []), ...(r.data ?? []).map(x => ({ ...x, kind: 'return' }))].sort((a, b) => b.created_at.localeCompare(a.created_at)) as Hist[];
  } });
  if (!issue) return null;
  const s = issueSplit(issue);
  const q = Number(qty.replace(',', '.'));
  const errors: string[] = [];
  if (!Number.isFinite(q) || q <= 0) errors.push('Количество больше 0');
  else if (q > s.outstanding) errors.push(`Больше числящегося: доступно ${fmtQty(s.outstanding)}`);
  if (mode === 'return' && !wh) errors.push('Выберите склад');
  if (mode === 'install' && !eq) errors.push('Выберите технику');
  if (mode !== 'return' && !date) errors.push('Укажите дату');
  const done = async (title: string) => { await qc.invalidateQueries({ queryKey: ['wh-qr'] }); await qc.invalidateQueries({ queryKey: ['wh-my-issues'] }); toast({ title }); };
  const fail = (e: unknown) => toast({ title: 'Операция не выполнена', description: (e as { message?: string })?.message ?? String(e), variant: 'destructive' });
  const save = async () => { setBusy(true); try {
    const { error } = mode === 'return' ? await supabase.rpc('warehouse_return_issue', { _operation_key: key, _issue_id: issue.id, _quantity: q, _warehouse_id: wh ?? '', _condition: cond, _note: note })
      : await supabase.rpc('warehouse_issue_usage', { _operation_key: key, _issue_id: issue.id, _kind: mode, _quantity: q, _equipment_id: mode === 'install' ? (eq ?? null) as unknown as string : (null as unknown as string), _operation_date: date, _note: note });
    if (error) throw error; await done(mode === 'return' ? 'Возврат проведён' : mode === 'install' ? 'Установка записана' : 'Расход записан'); onOpenChange(false);
  } catch (e) { fail(e); } finally { setBusy(false); } };
  const confirmReceived = async () => { setBusy(true); try { const { error } = await supabase.rpc('confirm_issue_received', { _issue_id: issue.id }); if (error) throw error; await done('Получение подтверждено'); onOpenChange(false); } catch (e) { fail(e); } finally { setBusy(false); } };
  const doReverse = async () => { if (!reverse) return; setBusy(true); try { const { error } = await supabase.rpc('warehouse_reverse_operation', { _operation_key: crypto.randomUUID(), _kind: reverse.kind === 'return' ? 'return' : 'usage', _id: reverse.id, _reason: reason }); if (error) throw error; await done('Исправление проведено'); setReverse(null); setReason(''); } catch (e) { fail(e); } finally { setBusy(false); } };
  const reversed = new Set(hist.flatMap(h => h.reversal_of ? [h.reversal_of] : []));
  const whName = (id?: string) => refs?.warehouses.find(w => w.id === id)?.name ?? '—';
  const label = (h: Hist) => h.reversal_of ? 'Исправление' : h.kind === 'return' ? (h.condition === 'damaged' ? 'Возврат (повреждено)' : 'Возврат') : h.kind === 'install' ? 'Установлено' : 'Израсходовано';
  return <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle className="break-words">{unitName}</DialogTitle></DialogHeader>
    <div className="text-sm space-y-1">
      <p className="text-muted-foreground">Кому: {issue.recipient_name} · {issue.operation_date ?? issue.created_at.slice(0, 10)}</p>
      <p className="font-numeric">Выдано {fmtQty(s.issued)} {unit} · <b>Числится {fmtQty(s.outstanding)}</b> · Установлено {fmtQty(s.installed)} · Израсходовано {fmtQty(s.consumed)} · Возвращено {fmtQty(s.returned)}</p>
      {issue.note && <p className="text-muted-foreground">Примечание: {issue.note}</p>}
      {issue.received_confirmed_at ? <p className="text-success">Получил: {format(new Date(issue.received_confirmed_at), 'dd.MM.yyyy HH:mm')}{issue.received_confirmed_proxy ? ' (подтвердил администратор)' : ''}</p>
        : <Button variant="outline" className="min-h-11" disabled={busy} onClick={confirmReceived}>{me && me === issue.recipient_user_id ? 'Получил' : 'Получил (за получателя)'}</Button>}
    </div>
    {s.outstanding > 0 && <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap gap-2">{([['return', 'Возврат'], ['install', 'Установка'], ['consume', 'Расход']] as const).map(([k, t]) => <Button key={k} variant={mode === k ? 'default' : 'outline'} className="min-h-11" onClick={() => { setMode(k); setKey(crypto.randomUUID()); }}>{t}</Button>)}</div>
      <Label htmlFor="ia-qty">Количество, {unit} (доступно {fmtQty(s.outstanding)})</Label><Input id="ia-qty" inputMode="decimal" className="min-h-11 font-numeric" value={qty} onChange={e => setQty(e.target.value)} />
      {mode === 'return' && <><Label>На склад</Label><TaskLookupSelect label="Склад" value={wh} onChange={setWh} options={(refs?.warehouses ?? []).filter(w => !w.archived_at).map(w => ({ id: w.id, name: w.name }))} />
        <div className="flex gap-2"><Button variant={cond === 'good' ? 'default' : 'outline'} className="min-h-11" onClick={() => setCond('good')}>Исправно</Button><Button variant={cond === 'damaged' ? 'destructive' : 'outline'} className="min-h-11" onClick={() => setCond('damaged')}>Повреждено</Button></div>
        {cond === 'damaged' && <p className="text-xs text-muted-foreground">Повреждённое хранится отдельно и не попадает в доступный остаток.</p>}</>}
      {mode === 'install' && <><Label>Техника</Label><TaskLookupSelect label="Техника" value={eq} onChange={setEq} options={(refs?.equipment ?? []).map(e => ({ id: e.id, name: [e.plate_number, e.model, e.brand].filter(Boolean).join(' • ') }))} /></>}
      {mode !== 'return' && <><Label htmlFor="ia-date">Дата</Label><Input id="ia-date" type="date" className="min-h-11" value={date} onChange={e => setDate(e.target.value)} /></>}
      <Input placeholder="Примечание" aria-label="Примечание" className="min-h-11" value={note} onChange={e => setNote(e.target.value)} />
      {errors.length > 0 && qty !== '' && <ul className="text-sm text-destructive">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <DialogFooter><Button className="min-h-11" disabled={busy || errors.length > 0} onClick={save}>{busy ? 'Сохранение…' : 'Подтвердить'}</Button></DialogFooter>
    </div>}
    {hist.length > 0 && <div className="border-t pt-3 space-y-2"><h3 className="text-sm font-medium">История</h3>{hist.map(h => <div key={h.id} className="text-sm flex gap-2 items-start"><div className="flex-1 min-w-0"><p className={h.reversal_of || reversed.has(h.id) ? 'text-muted-foreground' : ''}>{label(h)} · <span className="font-numeric">{fmtQty(Number(h.quantity))} {unit}</span>{h.kind === 'return' && ` · ${whName(h.warehouse_id)}`}{reversed.has(h.id) && ' · исправлено'}</p><p className="text-xs text-muted-foreground break-words">{format(new Date(h.created_at), 'dd.MM.yyyy HH:mm')}{h.note ? ` · ${h.note}` : ''}{h.reason ? ` · Причина: ${h.reason}` : ''}</p></div>{!h.reversal_of && !reversed.has(h.id) && <Button variant="ghost" className="min-h-11 text-xs" onClick={() => { setReverse(h); setReason(''); }}>Исправить</Button>}</div>)}</div>}
    {reverse && <div className="border-t pt-3 space-y-2"><p className="text-sm">Обратная операция для «{label(reverse)} {fmtQty(Number(reverse.quantity))} {unit}». Запись в журнале сохранится.</p><Input placeholder="Причина исправления *" aria-label="Причина исправления" className="min-h-11" value={reason} onChange={e => setReason(e.target.value)} /><div className="flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => setReverse(null)}>Отмена</Button><Button className="min-h-11" disabled={busy || reason.trim().length < 3} onClick={doReverse}>Провести исправление</Button></div></div>}
  </DialogContent></Dialog>;
}
