import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { loadReceiptLabels, warehouseRows } from '@/lib/simpleWarehouse';
import { LabelExporter } from './LabelExporter';
import { receiptDraft, validReceiptLines, RECEIPT_UNITS, type ReceiptLine } from '@/lib/receiptDraft';

type RequestInfo = { id: string; status: string; organization_id: string | null; request_number: string; description?:string|null };
type Receipt = { request_id: string; document_id: string; warehouse_id: string; receiver_name: string; received_at: string };
type Line = ReceiptLine;
export function RequestReceiptButton({ request, openSignal = 0 }: { request: RequestInfo; openSignal?: number }) {
 const org = request.organization_id;
 const [open,setOpen] = useState(false);
 const [warehouse,setWarehouse] = useState<string | null>(null);
 const [receiver,setReceiver] = useState<string | null>(null);
 const [lines,setLines] = useState<Line[]>([]);
 const [busy,setBusy] = useState(false);
 const [confirm,setConfirm] = useState(false);
 const qc = useQueryClient(); const { toast } = useToast();
 const { data: allowed = false } = useQuery({queryKey:['wh-receipt-permission',org],enabled:!!org,queryFn:async()=>{
   if(!org) return false; const {data:{user}}=await supabase.auth.getUser(); if(!user) return false;
  const {data,error}=await supabase.rpc('user_has_org_access',{_user_id:user.id,_org_id:org}); if(error) throw error; return data===true;
 }});
 const {data:receipts=[],error:receiptError}=useQuery({queryKey:['wh-receipts',org],enabled:!!org&&allowed,queryFn:()=>warehouseRows<Receipt>((f,t)=>supabase.from('warehouse_request_receipts').select('request_id,document_id,warehouse_id,receiver_name,received_at').eq('organization_id',org ?? '').order('id').range(f,t))});
 const receipt=receipts.find(r=>r.request_id===request.id);
 const {data:labels=[],error:labelError}=useQuery({queryKey:['wh-receipt-labels',receipt?.document_id],enabled:open&&!!receipt,queryFn:()=>loadReceiptLabels(receipt?.document_id??'')});
 const handledSignal = useRef(0);
 useEffect(()=>{
  if(openSignal>handledSignal.current&&allowed&&(request.status==='Доставлено'||!!receipt)){
   handledSignal.current=openSignal;
   setOpen(true);setConfirm(false);
  }
 },[openSignal,allowed,request.status,receipt]);
 const {data:warehouses=[],error:warehouseError}=useQuery({queryKey:['wh-qr','warehouses',org],enabled:allowed,queryFn:()=>warehouseRows<{id:string;name:string;request_objects:{name:string}|null}>((f,t)=>supabase.from('warehouses').select('id,name,description,request_objects!warehouses_object_id_fkey(name)').eq('organization_id',org ?? '').order('name').range(f,t))});
 const {data:details,isLoading,error}=useQuery({queryKey:['wh-receipt-details',request.id],enabled:open&&!receipt,queryFn:async()=>{
  const [{data:items,error:ie},{data:members,error:me},{data:{user}},{data:sourceRequest,error:re}]=await Promise.all([
   supabase.from('request_items').select('id,name,quantity').eq('request_id',request.id).order('created_at'),
   supabase.from('user_organizations').select('user_id').eq('organization_id',org ?? '').eq('is_active',true),supabase.auth.getUser(),supabase.from('requests').select('applicant').eq('id',request.id).single()]);
  if(ie) throw ie; if(me) throw me; if(re)throw re;
  const ids=(members??[]).map(m=>m.user_id);
  const {data:profiles,error:pe}=await supabase.from('profiles').select('id,full_name').in('id',ids);
  if(pe) throw pe;
  return {items:items??[],applicant:sourceRequest?.applicant,members:(members??[]).map(m=>({...m,name:profiles?.find(p=>p.id===m.user_id)?.full_name??'—'})),userId:user?.id??null};
 }});
 useEffect(()=>{if(details){setLines(receiptDraft(details.items,request.description??''));setReceiver(details.userId);}},[details,open,request.id]);
 const notifyError=(e:unknown)=>toast({title:'Приёмка не выполнена',description:(e as {message?:string})?.message??String(e),variant:'destructive'});
 const save=async()=>{
  if(!warehouse||!receiver||!validReceiptLines(lines)) return; setBusy(true);
  try {const {data,error}=await supabase.rpc('receive_warehouse_request',{_request_id:request.id,_warehouse_id:warehouse,_received_by:receiver,_lines:lines.map(l=>({item_id:l.id,quantity:l.quantity,kind:l.kind,unit:l.unit}))});if(error)throw error;
   await Promise.all([qc.invalidateQueries({queryKey:['wh-receipts']}),qc.invalidateQueries({queryKey:['wh-qr']}),qc.invalidateQueries({queryKey:['requests']})]);
   setConfirm(false);toast({title:'Принято на склад'});
  }catch(e){notifyError(e);}finally{setBusy(false);}
 };
 if(!allowed||(!receipt&&request.status!=='Доставлено'))return null;
 const whLabel=(w:typeof warehouses[number])=>[w.request_objects?.name,w.name].filter(Boolean).join(' — ');
 return <div data-row-action onClick={e=>e.stopPropagation()} className="min-w-0">
  <Button variant={receipt?'outline':'default'} className="min-h-11 h-auto max-w-full whitespace-normal text-left justify-start gap-2 text-xs" onClick={()=>{setOpen(true);setConfirm(false);}}>
   <PackageCheck className="h-4 w-4 shrink-0"/>{receipt?'Принято на склад':'Осуществить приёмку'}
  </Button>
  {receipt&&<p className="text-xs text-muted-foreground break-words mt-1">{receipt.receiver_name} · {format(new Date(receipt.received_at),'dd.MM.yyyy HH:mm')} · {warehouses.find(w=>w.id===receipt.warehouse_id)?.name??'—'}</p>}
  <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none">
   <DialogHeader><DialogTitle className="break-words">Приёмка · {request.description||'—'}</DialogTitle><p className="text-sm text-muted-foreground">{request.request_number.replace(/^REQ-/,'')}</p></DialogHeader>
   {(warehouseError||receiptError)&&<p role="alert" className="text-destructive">Не удалось загрузить данные приёмки: {(warehouseError??receiptError)?.message}</p>}
   {receipt?<div className="space-y-3"><p className="font-medium text-success">Принято на склад</p><p>{receipt.receiver_name} · {format(new Date(receipt.received_at),'dd.MM.yyyy HH:mm')}</p><p>{warehouses.find(w=>w.id===receipt.warehouse_id)?.name??'—'}</p>{labelError?<p role="alert" className="text-destructive">Не удалось загрузить наклейки: {labelError.message}</p>:labels.length?<LabelExporter labels={labels}/>:<p>Загрузка наклеек…</p>}</div>:<>
    {isLoading?<Loader2 className="animate-spin"/>:error?<p className="text-destructive">Не удалось загрузить позиции и сотрудников</p>:<div className="space-y-4">
    <Label>Склад</Label><TaskLookupSelect label="Выберите склад" value={warehouse} onChange={setWarehouse} options={warehouses.map(w=>({id:w.id,name:whLabel(w)}))} disabled={confirm}/>
    <Label>Кто осуществил приёмку</Label><TaskLookupSelect label="Сотрудник" value={receiver} onChange={setReceiver} options={(details?.members??[]).map(m=>({id:m.user_id,name:m.name}))} disabled={confirm}/>
    <p className="text-sm text-muted-foreground">Дата: {format(new Date(),'dd.MM.yyyy')}</p>
    {lines.map((l,i)=><div key={l.id??'request'} className="border-b pb-3 space-y-2"><p className="font-medium break-words">{l.name||'Укажите название заявки'}</p><div className="flex flex-wrap items-center gap-2">{l.id?<span className="font-numeric" aria-label="Количество">{l.quantity}</span>:<Input type="number" min="0.000001" step="any" inputMode="decimal" aria-label="Количество" placeholder="Количество *" required className="w-32 min-h-11" value={l.quantity} disabled={confirm} onChange={e=>setLines(old=>old.map((x,n)=>n===i?{...x,quantity:e.target.value===''?'':Number(e.target.value)}:x))}/>}<Select value={l.unit} disabled={confirm} onValueChange={v=>setLines(old=>old.map((x,n)=>n===i?{...x,unit:v as Line['unit']}:x))}><SelectTrigger className="w-36 min-h-11" aria-label={`Единица: ${l.name}`}><SelectValue/></SelectTrigger><SelectContent>{RECEIPT_UNITS.map(u=><SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select></div></div>)}
    {lines.length>0&&<LabelExporter preview labels={lines.map(l=>({kind:'unit',token:l.id??'',title:request.description||l.name,applicant:details?.applicant,receiver:details?.members.find(m=>m.user_id===receiver)?.name,lines:[]}))}/>}
    </div>}
    <DialogFooter className="gap-2">{confirm?<><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>setConfirm(false)}>Назад</Button><Button className="min-h-11" disabled={busy||!validReceiptLines(lines)||!!warehouseError||!!receiptError} onClick={save}>{busy?'Сохранение…':'Подтвердить приёмку'}</Button></>:<Button className="min-h-11" disabled={!warehouse||!receiver||!validReceiptLines(lines)||isLoading||!!error||!!warehouseError||!!receiptError} onClick={()=>setConfirm(true)}>Сохранить приёмку</Button>}</DialogFooter>
   </>}
  </DialogContent></Dialog>
 </div>;
}
