import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Loader2, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { loadReceiptLabels, warehouseRows } from '@/lib/simpleWarehouse';
import { LabelExporter } from './LabelExporter';
import { RECEIPT_UNITS } from '@/lib/receiptDraft';
import { canReceiveStatus, canSubmit, fallbackExpected, hasDiscrepancy, lineErrors, payload, receivedByItem, remaining, type DraftLine } from '@/lib/partialReceipt';

type RequestInfo = { id: string; status: string; organization_id: string | null; request_number: string; description?: string | null };
type Legacy = { document_id: string; warehouse_id: string; receiver_name: string; received_at: string };
type BatchLine = { id: string; request_item_id: string | null; expected_qty: number; accepted_qty: number; defect_qty: number; unit: string; note: string | null; photo_paths: string[] };
type Batch = { id: string; document_id: string | null; warehouse_id: string; receiver_name: string; created_at: string; warehouse_receipt_batch_lines: BatchLine[] };

/** Partial request receipt: lines, actual quantity, defect with note and private photos, remaining to receive. */
export function RequestReceiptButton({ request, openSignal = 0 }: { request: RequestInfo; openSignal?: number }) {
  const org = request.organization_id;
  const [open, setOpen] = useState(false);
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [receiver, setReceiver] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [labelDoc, setLabelDoc] = useState<string | null>(null);
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: allowed = false } = useQuery({ queryKey: ['wh-receipt-permission', org], enabled: !!org, queryFn: async () => {
    if (!org) return false; const { data: { user } } = await supabase.auth.getUser(); if (!user) return false;
    const { data, error } = await supabase.rpc('user_has_org_access', { _user_id: user.id, _org_id: org }); if (error) throw error; return data === true;
  } });
  // Scoped to this request only (previously the whole organization's receipts were loaded on every panel open).
  const { data: state, error: stateError } = useQuery({ queryKey: ['wh-receipts', request.id], enabled: !!org && allowed, queryFn: async () => {
    const [legacy, batches] = await Promise.all([
      supabase.from('warehouse_request_receipts').select('document_id,warehouse_id,receiver_name,received_at').eq('request_id', request.id).maybeSingle(),
      supabase.from('warehouse_receipt_batches').select('id,document_id,warehouse_id,receiver_name,created_at,warehouse_receipt_batch_lines(id,request_item_id,expected_qty,accepted_qty,defect_qty,unit,note,photo_paths)').eq('request_id', request.id).order('created_at'),
    ]);
    if (legacy.error) throw legacy.error; if (batches.error) throw batches.error;
    return { legacy: legacy.data as Legacy | null, batches: (batches.data ?? []) as unknown as Batch[] };
  } });
  const legacy = state?.legacy ?? null, batches = state?.batches ?? [];
  const received = useMemo(() => batches.flatMap(b => b.warehouse_receipt_batch_lines), [batches]);
  const { data: details, isLoading, error } = useQuery({ queryKey: ['wh-receipt-details', request.id], enabled: open && !legacy, queryFn: async () => {
    const [{ data: items, error: ie }, { data: members, error: me }, { data: { user } }, { data: src, error: re }] = await Promise.all([
      supabase.from('request_items').select('id,name,quantity').eq('request_id', request.id).order('created_at'),
      supabase.from('user_organizations').select('user_id').eq('organization_id', org ?? '').eq('is_active', true), supabase.auth.getUser(), supabase.from('requests').select('applicant').eq('id', request.id).single()]);
    if (ie) throw ie; if (me) throw me; if (re) throw re;
    const ids = (members ?? []).map(m => m.user_id);
    const { data: profiles, error: pe } = ids.length ? await supabase.from('profiles').select('id,full_name').in('id', ids) : { data: [], error: null };
    if (pe) throw pe;
    return { items: items ?? [], applicant: src?.applicant, members: (members ?? []).map(m => ({ ...m, name: profiles?.find(p => p.id === m.user_id)?.full_name ?? '—' })), userId: user?.id ?? null };
  } });
  const { data: warehouses = [], error: warehouseError } = useQuery({ queryKey: ['wh-qr', 'warehouses', org], enabled: allowed && !!org, queryFn: () => warehouseRows<{ id: string; name: string; archived_at: string | null; request_objects: { name: string } | null }>((f, t) => supabase.from('warehouses').select('id,name,archived_at,request_objects!warehouses_object_id_fkey(name)').eq('organization_id', org ?? '').order('name').range(f, t)) });
  const activeWarehouses = warehouses.filter(w => !w.archived_at);
  const fbExpected = fallbackExpected(received);
  const totalLeft = details ? (details.items.length ? details.items.reduce((s, i) => s + remaining(i.quantity, receivedByItem(received).get(i.id) ?? 0), 0) : fbExpected == null ? 1 : remaining(fbExpected, receivedByItem(received).get(null) ?? 0)) : null;
  const leftFromState = useMemo(() => { if (!batches.length) return null; const exp = new Map<string | null, number>(); received.forEach(l => exp.set(l.request_item_id, Number(l.expected_qty))); const done = receivedByItem(received); let s = 0; exp.forEach((e, k) => s += remaining(e, done.get(k) ?? 0)); return s; }, [batches, received]);
  const fullyDone = !!legacy || (totalLeft ?? leftFromState) === 0;

  useEffect(() => {
    if (!details || !open) return;
    const done = receivedByItem(received);
    setLines(details.items.length ? details.items.map(i => ({ id: i.id, name: i.name, expected: i.quantity, done: done.get(i.id) ?? 0, accepted: '', defect: '', note: '', unit: (received.find(l => l.request_item_id === i.id)?.unit as DraftLine['unit']) ?? 'шт', photos: [] }))
      : [{ id: null, name: request.description || '', expected: fbExpected ?? '', done: done.get(null) ?? 0, accepted: '', defect: '', note: '', unit: (received[0]?.unit as DraftLine['unit']) ?? 'шт', photos: [] }]);
    setReceiver(r => r ?? details.userId); setConfirmed(false);
  }, [details, open, received, request.description, fbExpected]);
  const handled = useRef(0);
  useEffect(() => { if (openSignal > handled.current && allowed && (canReceiveStatus(request.status) || !!legacy || batches.length)) { handled.current = openSignal; setOpen(true); } }, [openSignal, allowed, request.status, legacy, batches.length]);

  const update = (i: number, patch: Partial<DraftLine>) => setLines(old => old.map((x, n) => n === i ? { ...x, ...patch } : x));
  const num = (v: string): number | '' => v === '' ? '' : Number(v.replace(',', '.'));
  const upload = async (i: number, files: FileList | null) => {
    if (!files?.length) return; setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, 10 - lines[i].photos.length)) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${request.request_number}/warehouse-receipt/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('request-photos').upload(path, file, { contentType: file.type });
        if (error) throw error; paths.push(path);
      }
      update(i, { photos: [...lines[i].photos, ...paths] });
    } catch (e) { toast({ title: 'Фото не загружено', description: (e as Error).message, variant: 'destructive' }); } finally { setUploading(false); }
  };
  const save = async () => {
    if (!warehouse || !receiver || !canSubmit(lines, confirmed)) return; setBusy(true);
    try {
      const { data, error } = await supabase.rpc('receive_request_partial', { _operation_key: key, _request_id: request.id, _warehouse_id: warehouse, _received_by: receiver, _lines: payload(lines, fbExpected != null), _confirm_discrepancy: confirmed });
      if (error) throw error;
      const doc = (data as { document_id?: string | null } | null)?.document_id ?? null;
      setKey(crypto.randomUUID()); setLabelDoc(doc);
      await Promise.all([qc.invalidateQueries({ queryKey: ['wh-receipts'] }), qc.invalidateQueries({ queryKey: ['wh-qr'] }), qc.invalidateQueries({ queryKey: ['wh-receipt-details', request.id] })]);
      toast({ title: 'Приёмка сохранена' });
    } catch (e) { toast({ title: 'Приёмка не выполнена', description: (e as { message?: string })?.message ?? String(e), variant: 'destructive' }); } finally { setBusy(false); }
  };
  const docForLabels = labelDoc ?? legacy?.document_id ?? null;
  const { data: labels = [], error: labelError } = useQuery({ queryKey: ['wh-receipt-labels', docForLabels], enabled: open && !!docForLabels, queryFn: () => loadReceiptLabels(docForLabels ?? '') });

  if (!allowed || (!legacy && !batches.length && !canReceiveStatus(request.status))) return null;
  const whName = (id: string) => warehouses.find(w => w.id === id)?.name ?? '—';
  const whLabel = (w: typeof warehouses[number]) => [w.request_objects?.name, w.name].filter(Boolean).join(' — ');
  const discrepancy = hasDiscrepancy(lines);
  return <div data-row-action onClick={e => e.stopPropagation()} className="min-w-0">
    <Button variant={fullyDone ? 'outline' : 'default'} className="min-h-11 h-auto max-w-full whitespace-normal text-left justify-start gap-2 text-xs" onClick={() => { setOpen(true); setLabelDoc(null); }}>
      <PackageCheck className="h-4 w-4 shrink-0" />{fullyDone ? 'Принято на склад' : batches.length ? `Принять остаток${leftFromState ? ` · ${leftFromState}` : ''}` : 'Осуществить приёмку'}
    </Button>
    {legacy && <p className="text-xs text-muted-foreground break-words mt-1">{legacy.receiver_name} · {format(new Date(legacy.received_at), 'dd.MM.yyyy HH:mm')} · {whName(legacy.warehouse_id)}</p>}
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none">
      <DialogHeader><DialogTitle className="break-words">Приёмка · {request.description || '—'}</DialogTitle><p className="text-sm text-muted-foreground">{request.request_number.replace(/^REQ-/, '')}</p></DialogHeader>
      {(warehouseError || stateError) && <p role="alert" className="text-destructive">Не удалось загрузить данные приёмки: {(warehouseError ?? stateError)?.message}</p>}
      {legacy ? <div className="space-y-3"><p className="font-medium text-success">Принято на склад</p><p>{legacy.receiver_name} · {format(new Date(legacy.received_at), 'dd.MM.yyyy HH:mm')}</p><p>{whName(legacy.warehouse_id)}</p></div> : <>
        {batches.length > 0 && <div className="space-y-2 border-b pb-3"><h3 className="text-sm font-medium">Уже принято</h3>{batches.map(b => <div key={b.id} className="text-sm space-y-0.5"><p className="text-muted-foreground">{format(new Date(b.created_at), 'dd.MM.yyyy HH:mm')} · {b.receiver_name} · {whName(b.warehouse_id)}</p>{b.warehouse_receipt_batch_lines.map(l => <p key={l.id} className="font-numeric break-words">{(details?.items.find(i => i.id === l.request_item_id)?.name ?? request.description) || '—'}: принято {Number(l.accepted_qty)}{Number(l.defect_qty) > 0 ? `, брак ${Number(l.defect_qty)}` : ''} {l.unit}{l.note ? ` · ${l.note}` : ''}{l.photo_paths.length ? ` · фото ${l.photo_paths.length}` : ''}</p>)}<Button variant="link" className="h-auto p-0 text-xs" disabled={!b.document_id} onClick={() => setLabelDoc(b.document_id)}>Наклейки этой приёмки</Button></div>)}</div>}
        {!fullyDone && (isLoading ? <Loader2 className="animate-spin" /> : error ? <p className="text-destructive">Не удалось загрузить позиции и сотрудников</p> : <div className="space-y-4">
          <Label>Склад</Label><TaskLookupSelect label="Выберите склад" value={warehouse} onChange={setWarehouse} options={activeWarehouses.map(w => ({ id: w.id, name: whLabel(w) }))} />
          <Label>Кто принял</Label><TaskLookupSelect label="Сотрудник" value={receiver} onChange={setReceiver} options={(details?.members ?? []).map(m => ({ id: m.user_id, name: m.name }))} />
          <p className="text-sm text-muted-foreground">Дата: {format(new Date(), 'dd.MM.yyyy')}</p>
          {lines.map((l, i) => { const left = remaining(l.expected, l.done); const errs = (Number(l.accepted) || Number(l.defect)) ? lineErrors(l) : []; return <div key={l.id ?? 'request'} className="border-b pb-3 space-y-2">
            <p className="font-medium break-words">{l.name || 'Укажите название заявки'}</p>
            {l.id === null && fbExpected == null ? <div className="flex items-center gap-2"><Label htmlFor="fb-exp" className="text-xs">Ожидается всего *</Label><Input id="fb-exp" inputMode="decimal" className="w-28 min-h-11 font-numeric" value={l.expected} onChange={e => update(i, { expected: num(e.target.value) })} /></div>
              : <p className="text-xs text-muted-foreground font-numeric">Ожидается {l.expected} · принято {l.done} · осталось {left}</p>}
            {(left > 0 || l.expected === '') && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><Label className="text-xs">Принято</Label><Input inputMode="decimal" aria-label={`Принято: ${l.name}`} className="min-h-11 font-numeric" value={l.accepted} onChange={e => update(i, { accepted: num(e.target.value) })} /></div>
              <div><Label className="text-xs">Брак</Label><Input inputMode="decimal" aria-label={`Брак: ${l.name}`} className="min-h-11 font-numeric" value={l.defect} onChange={e => update(i, { defect: num(e.target.value) })} /></div>
              <div><Label className="text-xs">Единица</Label><Select value={l.unit} onValueChange={v => update(i, { unit: v as DraftLine['unit'] })}><SelectTrigger className="min-h-11" aria-label={`Единица: ${l.name}`}><SelectValue /></SelectTrigger><SelectContent>{RECEIPT_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="col-span-2 sm:col-span-3"><Input placeholder="Примечание (недостача, брак)" aria-label={`Примечание: ${l.name}`} className="min-h-11" value={l.note} onChange={e => update(i, { note: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-2"><Label className="inline-flex items-center gap-2 cursor-pointer text-xs border rounded-md px-3 min-h-11"><Camera className="h-4 w-4" />Фото<input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={e => { upload(i, e.target.files); e.target.value = ''; }} /></Label>{l.photos.map(p => <span key={p} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">фото<button type="button" aria-label="Убрать фото" onClick={() => update(i, { photos: l.photos.filter(x => x !== p) })}><X className="h-3 w-3" /></button></span>)}{uploading && <Loader2 className="h-4 w-4 animate-spin" />}</div>
            </div>}
            {errs.map(e => <p key={e} className="text-xs text-destructive">{e}</p>)}
          </div>; })}
          {discrepancy && lines.some(l => Number(l.accepted) || Number(l.defect)) && <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} className="mt-0.5" /><span>Подтверждаю расхождение: недостача или брак. Остаток можно принять позже.</span></label>}
        </div>)}
        {!fullyDone && <DialogFooter className="gap-2"><Button className="min-h-11" disabled={busy || uploading || !warehouse || !receiver || !canSubmit(lines, confirmed)} onClick={save}>{busy ? 'Сохранение…' : 'Подтвердить приёмку'}</Button></DialogFooter>}
      </>}
      {docForLabels && (labelError ? <p role="alert" className="text-destructive">Не удалось загрузить наклейки: {labelError.message}</p> : labels.length ? <LabelExporter labels={labels} /> : <p>Загрузка наклеек…</p>)}
    </DialogContent></Dialog>
  </div>;
}
