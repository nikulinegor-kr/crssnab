import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Printer, QrCode, ScanLine, ArrowRightLeft, PackageMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { CameraScanDialog } from '@/components/warehouse-qr/CameraScanDialog';
import { OperationDialog } from '@/components/warehouse-qr/OperationDialog';
import { warehouseRows } from '@/lib/simpleWarehouse';
import { parseQrInput } from '@/lib/warehouseQr';
import { printLabels } from '@/lib/warehouseLabels';
import type { WhBalance, WhUnit, WhWarehouse } from '@/components/warehouse-qr/types';
export default function QrWarehousePage(){
 const {currentOrgId:org}=useCurrentOrganization();const navigate=useNavigate();const {toast}=useToast();const [params]=useSearchParams();
 const [scan,setScan]=useState('');const [camera,setCamera]=useState(false);const [search,setSearch]=useState('');const [warehouse,setWarehouse]=useState<string|null>(null);
 const [card,setCard]=useState<WhUnit|null>(null);const [source,setSource]=useState<string|undefined>();const [op,setOp]=useState<'move'|'issue'|null>(null);const ref=useRef<HTMLInputElement>(null);
 const {data:allowed=false,isLoading:permissionLoading}=useQuery({queryKey:['wh-permission',org],enabled:!!org,queryFn:async()=>{if(!org)return false;const {data:{user}}=await supabase.auth.getUser();if(!user)return false;const {data,error}=await supabase.rpc('user_can_use_qr_warehouse',{_user:user.id,_org:org});if(error)throw error;return data===true;}});
 const enabled=!!org&&allowed;
 const {data:warehouses=[],error:we}=useQuery({queryKey:['wh-qr','warehouses',org],enabled,queryFn:()=>warehouseRows<WhWarehouse&{request_objects:{name:string}|null}>((f,t)=>supabase.from('warehouses').select('id,name,request_objects(name)').eq('organization_id',org??'').order('name').range(f,t))});
 const {data:units=[],error:ue,isLoading}=useQuery({queryKey:['wh-qr','units',org],enabled,queryFn:()=>warehouseRows<WhUnit>((f,t)=>supabase.from('warehouse_units').select('id,kind,name,serial_number,batch_number,unit,qr_token,product_id,created_at').eq('organization_id',org??'').order('created_at',{ascending:false}).range(f,t))});
 const {data:balances=[],error:be}=useQuery({queryKey:['wh-qr','balances',org],enabled,queryFn:()=>warehouseRows<WhBalance>((f,t)=>supabase.from('warehouse_balances').select('id,unit_id,warehouse_id,cell_id,quantity').eq('organization_id',org??'').gt('quantity',0).order('id').range(f,t))});
 const {data:history=[]}=useQuery({queryKey:['wh-qr','history',org,card?.id],enabled:enabled&&!!card,queryFn:async()=>{const {data,error}=await supabase.from('warehouse_ledger').select('id,operation,delta,created_at,profiles:created_by(full_name)').eq('unit_id',card?.id??'').eq('organization_id',org??'').order('created_at',{ascending:false}).limit(10);if(error)throw error;return data??[];}});
 const openCode=(raw:string)=>{const code=parseQrInput(raw);const unit=code?.kind!=='cell'?units.find(u=>u.qr_token===code?.token):null;if(unit){setCard(unit);setSource(undefined);}else toast({title:code?'ТМЦ не найдена в вашей организации':'Код не распознан',variant:'destructive'});};
 useEffect(()=>{const code=params.get('qr');if(code&&units.length){openCode(code);}},[params,units]); // eslint-disable-line react-hooks/exhaustive-deps
 const stocks=(id:string)=>warehouses.map(w=>({...w,quantity:balances.filter(b=>b.unit_id===id&&b.warehouse_id===w.id).reduce((s,b)=>s+Number(b.quantity),0)})).filter(w=>w.quantity>0);
 const terms=search.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const filtered=useMemo(()=>units.filter(u=>terms.every(t=>`${u.name} ${u.serial_number??''} ${u.batch_number??''}`.toLowerCase().includes(t))&&(!warehouse||balances.some(b=>b.unit_id===u.id&&b.warehouse_id===warehouse&&Number(b.quantity)>0))),[units,balances,warehouse,search]); // eslint-disable-line react-hooks/exhaustive-deps
 const [limit,setLimit]=useState(60);useEffect(()=>setLimit(60),[search,warehouse]);
 const label=(u:WhUnit)=>({kind:'unit' as const,token:u.qr_token,title:u.name,lines:[u.serial_number??u.batch_number??'',u.kind==='item'?'Изделие':`Материал · ${u.unit}`]});
 const print=async(u:WhUnit[])=>{try{await printLabels(u.map(label));}catch(e){toast({title:'Печать недоступна',description:(e as {message?:string})?.message,variant:'destructive'});}};
 if(permissionLoading)return <p className="p-4">Загрузка…</p>;
 if(!allowed)return <div className="p-4"><h1 className="text-xl font-semibold">Нет доступа к складу</h1><p className="text-muted-foreground mt-2">Требуется существующее право «Склад».</p></div>;
 return <div className="max-w-6xl mx-auto space-y-4 min-w-0">
 <div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Назад к складу" onClick={()=>navigate('/warehouse')}><ArrowLeft className="h-4 w-4"/></Button><h1 className="text-xl font-semibold">ТМЦ и QR</h1></div>
 <form className="flex gap-2" onSubmit={e=>{e.preventDefault();openCode(scan);setScan('');}}><div className="relative min-w-0 flex-1"><ScanLine className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input ref={ref} value={scan} onChange={e=>setScan(e.target.value)} aria-label="Код QR" placeholder="QR или код ТМЦ" className="pl-9 min-h-11"/></div><Button className="min-h-11" type="submit">Открыть</Button><Button type="button" variant="outline" className="h-11 w-11 shrink-0" aria-label="Сканировать камерой" onClick={()=>setCamera(true)}><Camera className="h-4 w-4"/></Button></form>
 <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск ТМЦ" aria-label="Поиск ТМЦ" className="min-h-11"/><TaskLookupSelect label="Все склады" value={warehouse} onChange={setWarehouse} options={warehouses.map(w=>({id:w.id,name:[w.request_objects?.name,w.name].filter(Boolean).join(' — ')}))}/><Button variant="outline" className="min-h-11" disabled={!filtered.length} onClick={()=>print(filtered.slice(0,200))}><Printer className="h-4 w-4 mr-2"/>Печать наклеек</Button></div>
 {(we||ue||be)&&<p className="text-destructive">Не удалось загрузить склад. {(we??ue??be)?.message}</p>}
 {isLoading?<p>Загрузка ТМЦ…</p>:!filtered.length?<p className="text-muted-foreground py-6">ТМЦ не найдены</p>:<div className="divide-y border-y border-border">{filtered.slice(0,limit).map(u=>{const ss=stocks(u.id);return <div key={u.id} className="flex items-start gap-2 py-3"><Button variant="ghost" className="flex-1 min-w-0 h-auto min-h-11 justify-start text-left whitespace-normal" onClick={()=>{setCard(u);setSource(warehouse??undefined);}}><div className="min-w-0 space-y-1"><p className="font-medium break-words">{u.name}</p><p className="text-xs text-muted-foreground break-words">{u.kind==='item'?'Изделие':'Материал / партия'} · {u.serial_number??u.batch_number??'—'}</p><p className="text-sm font-numeric">{ss.length?ss.map(w=>`${w.name}: ${w.quantity} ${u.unit}`).join(' · '):`Остаток: 0 ${u.unit}`}</p></div></Button><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Этикетка: ${u.name}`} title="Печать этикетки" onClick={()=>print([u])}><Printer className="h-4 w-4"/></Button></div>;})}</div>}
 {filtered.length>limit&&<Button variant="outline" className="min-h-11" onClick={()=>setLimit(n=>n+60)}>Показать ещё</Button>}
 <CameraScanDialog open={camera} onOpenChange={setCamera} onResult={openCode}/>
 <Dialog open={!!card} onOpenChange={v=>{if(!v){setCard(null);setOp(null);}}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">{card&&<><DialogHeader><DialogTitle className="flex gap-2 items-start"><QrCode className="h-5 w-5 shrink-0"/>{card.name}</DialogTitle></DialogHeader><p className="text-muted-foreground text-sm break-words">{card.kind==='item'?'Изделие':'Материал / партия'} · {card.serial_number??card.batch_number??'—'}</p><div className="space-y-2">{stocks(card.id).length?stocks(card.id).map(w=><div key={w.id} className="flex justify-between gap-3"><span>{w.name}</span><span className="font-numeric shrink-0">{w.quantity} {card.unit}</span></div>):<p>Остаток: 0 {card.unit}</p>}</div>
 <DialogFooter className="gap-2 sm:justify-start"><Button className="min-h-11" disabled={!stocks(card.id).length} onClick={()=>setOp('move')}><ArrowRightLeft className="h-4 w-4 mr-2"/>Переместить</Button><Button className="min-h-11" disabled={!stocks(card.id).length} onClick={()=>setOp('issue')}><PackageMinus className="h-4 w-4 mr-2"/>Выдать</Button><Button variant="outline" className="min-h-11" onClick={()=>print([card])}><Printer className="h-4 w-4 mr-2"/>Этикетка</Button></DialogFooter>
 {history.length>0&&<div className="border-t pt-3 space-y-2"><h2 className="text-sm font-medium">Последние операции</h2>{history.map(h=><p key={h.id} className="text-xs text-muted-foreground">{({receipt:'Приёмка',move_out:'Перемещение',move_in:'Прибытие',issue:'Выдача',return:'Возврат'} as Record<string,string>)[h.operation]??h.operation} · {h.delta} · {new Date(h.created_at).toLocaleString('ru-RU')}</p>)}</div>}
 </>}</DialogContent></Dialog>
 {org&&<OperationDialog open={!!op} onOpenChange={v=>{if(!v)setOp(null);}} orgId={org} type={op??'move'} unit={card} warehouses={warehouses} balances={balances} fromWarehouseId={source}/>}
 </div>;
}
