import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Request } from '@/hooks/useRequests';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { RequestReceiptButton } from './RequestReceiptButton';
import { warehouseRows } from '@/lib/simpleWarehouse';
import { requestQrAction, shipmentDatesError } from '@/lib/requestQrWorkflow';

export function RequestQrWorkflow({ request, qrEntry, receiptOpenSignal }: { request: Request; qrEntry: boolean; receiptOpenSignal: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(qrEntry);
  const [delivery, setDelivery] = useState(false);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [shipment, setShipment] = useState('');
  const [arrival, setArrival] = useState('');
  const [actual, setActual] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receiptSignal, setReceiptSignal] = useState(0);
  const handled = useRef(false);
  const org = request.organization_id;
  // Always read the current server row on QR entry, never dispatch from a stale list/cache.
  const fresh = useQuery({ queryKey: ['request-qr-workflow', org, request.id], enabled: open, staleTime: 0, refetchOnMount: 'always', queryFn: async () => {
    const { data, error } = await supabase.from('requests').select('*').eq('id', request.id).eq('organization_id', org ?? '').single();
    if (error) throw error;
    return data as unknown as Request;
  }});
  const current = fresh.data ?? request;
  const receipt = useQuery({ queryKey: ['request-qr-received', org, request.id], enabled: open && !!fresh.data, queryFn: async () => {
    const { data, error } = await supabase.from('warehouse_request_receipts').select('id').eq('request_id', request.id).eq('organization_id', org ?? '').maybeSingle();
    if (error) throw error;
    return !!data;
  }});
  const permission = useQuery({ queryKey: ['request-qr-edit', org], enabled: open && !!org, queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !org) return false;
    const { data, error } = await supabase.rpc('user_can_edit_requests', { _user_id: user.id, _org_id: org });
    if (error) throw error;
    return data === true;
  }});
  const carriers = useQuery({ queryKey: ['request-qr-carriers', org], enabled: open && !!org, queryFn: async () => {
    const rows = await warehouseRows<{ transport_company: string | null }>((f,t) => supabase.from('requests').select('transport_company').eq('organization_id', org ?? '').not('transport_company','is',null).order('id').range(f,t));
    return Array.from(new Set(rows.map(r => r.transport_company?.trim()).filter((v): v is string => !!v))).sort((a,b) => a.localeCompare(b,'ru'));
  }});
  const action = requestQrAction(current.status, receipt.data === true);
  useEffect(() => {
    if (!open || !fresh.data || receipt.isPending || receipt.error || handled.current) return;
    handled.current = true;
    setCarrier(fresh.data.transport_company);
    setShipment(fresh.data.shipment_date ?? '');
    setArrival(fresh.data.planned_delivery_date ?? fresh.data.delivery_date ?? '');
    if (action === 'receipt' || action === 'received') { setReceiptSignal(n => n + 1); setOpen(false); }
  }, [open, fresh.data, receipt.isPending, receipt.error, action]);
  const save = async () => {
    if (busy || !org || !permission.data) return;
    const problem = delivery ? (!actual ? 'Укажите фактическую дату прихода' : actual < (current.shipment_date ?? '') ? 'Приход не раньше отгрузки' : actual > format(new Date(),'yyyy-MM-dd') ? 'Дата не может быть в будущем' : null) : shipmentDatesError(carrier,shipment,arrival);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc('confirm_request_qr_logistics', { _request_id: request.id, _organization_id: org, _action: delivery ? 'deliver' : 'ship', _carrier: carrier, _shipment_date: shipment || null, _planned_arrival: arrival || null, _actual_arrival: delivery ? actual : null });
      if (error) throw error;
      const result = data as unknown as { request: Request };
      qc.setQueryData(['request-qr-workflow',org,request.id],result.request);
      qc.setQueriesData({ queryKey: ['requests'] }, (old: unknown) => Array.isArray(old) ? old.map(r => r.id === request.id ? { ...r, ...result.request } : r) : old);
      await Promise.all([qc.invalidateQueries({queryKey:['requests']}), qc.invalidateQueries({queryKey:['request-qr-workflow',org,request.id]}), qc.invalidateQueries({queryKey:['request-shipments']})]);
      if (delivery) { setOpen(false); setDelivery(false); setReceiptSignal(n => n + 1); }
    } catch (e) { setError((e as {message?:string}).message ?? 'Не удалось подтвердить'); await fresh.refetch(); }
    finally { setBusy(false); }
  };
  const date = (v: string | null | undefined) => v ? format(new Date(v),'dd.MM.yyyy') : '—';
  const loading = fresh.isPending || receipt.isPending || permission.isPending;
  return <>
    <RequestReceiptButton request={current} openSignal={receiptOpenSignal + receiptSignal} />
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{delivery ? 'Подтвердить фактическую доставку' : action === 'shipment' ? 'Отгрузка' : 'Заявка'} · {current.description}</DialogTitle></DialogHeader>
      {loading ? <p>Загрузка…</p> : fresh.error || receipt.error || permission.error ? <p role="alert" className="text-destructive">Не удалось проверить заявку: {(fresh.error ?? receipt.error ?? permission.error)?.message}</p> : <>
        <p className="font-medium">{current.status}</p>
        {action === 'shipment' && !delivery ? <div className="space-y-3">
          <Label>Транспортная компания</Label><TaskLookupSelect label="Выберите ТК" value={carrier} onChange={setCarrier} options={(carriers.data ?? []).map(c => ({id:c,name:c}))} disabled={busy || !permission.data}/>
          {carriers.error && <p role="alert" className="text-destructive">{carriers.error.message}</p>}
          <Label htmlFor="qr-shipment">Дата отгрузки</Label><Input id="qr-shipment" type="date" className="min-h-11" value={shipment} onChange={e=>setShipment(e.target.value)} disabled={busy || !permission.data}/>
          <Label htmlFor="qr-planned">Плановая дата прихода</Label><Input id="qr-planned" type="date" className="min-h-11" min={shipment || undefined} value={arrival} onChange={e=>setArrival(e.target.value)} disabled={busy || !permission.data}/>
        </div> : <dl className="grid grid-cols-2 gap-3 text-sm"><dt>ТК</dt><dd className="break-words">{current.transport_company || '—'}</dd><dt>Отгрузка</dt><dd>{date(current.shipment_date)}</dd><dt>Ожидаемый приход</dt><dd>{date(current.planned_delivery_date ?? current.delivery_date)}</dd></dl>}
        {delivery && <div className="space-y-2"><Label htmlFor="qr-actual">Фактическая дата прихода</Label><Input id="qr-actual" type="date" className="min-h-11" min={current.shipment_date ?? undefined} max={format(new Date(),'yyyy-MM-dd')} value={actual} onChange={e=>setActual(e.target.value)} disabled={busy}/></div>}
        {!permission.data && <p className="text-muted-foreground">Нет права изменять логистику заявки.</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>delivery ? setDelivery(false) : setOpen(false)}>{delivery ? 'Назад' : 'Закрыть'}</Button>
          {permission.data && (action === 'shipment' || delivery) && <Button className="min-h-11" disabled={busy || !!carriers.error || (delivery ? !actual : !!shipmentDatesError(carrier,shipment,arrival))} onClick={save}>{busy ? 'Сохранение…' : delivery ? 'Подтвердить доставку и перейти к приёмке' : 'Подтвердить отгрузку'}</Button>}
          {permission.data && action === 'transit' && !delivery && <Button className="min-h-11" onClick={()=>{setError('');setDelivery(true);}}>Доставлено / Перейти к приёмке</Button>}
        </DialogFooter>
      </>}
    </DialogContent></Dialog>
  </>;
}