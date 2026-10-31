import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskLookupSelect } from '@/components/tasks/TaskLookupSelect';
import { useToast } from '@/hooks/use-toast';
import { warehouseRows, validateSimpleIssue } from '@/lib/simpleWarehouse';
import type { WhBalance, WhUnit, WhWarehouse } from './types';
interface Props { open:boolean; onOpenChange:(v:boolean)=>void; orgId:string; type:'move'|'issue'; unit:WhUnit|null; warehouses:WhWarehouse[]; balances:WhBalance[]; fromWarehouseId?:string; }
export function OperationDialog({open,onOpenChange,orgId,type,unit,warehouses,balances,fromWarehouseId}:Props){
 const {toast}=useToast();const qc=useQueryClient();
 const [source,setSource]=useState<string|null>(null);const [target,setTarget]=useState<string|null>(null);
 const [qty,setQty]=useState('1');const [recipient,setRecipient]=useState('');const [date,setDate]=useState(format(new Date(),'yyyy-MM-dd'));
 const [mode,setMode]=useState<'equipment'|'object'>('equipment');const [destination,setDestination]=useState<string|null>(null);
 const [key,setKey]=useState('');const [confirm,setConfirm]=useState(false);const [busy,setBusy]=useState(false);
 const stocks=useMemo(()=>warehouses.map(w=>({...w,quantity:balances.filter(b=>b.unit_id===unit?.id&&b.warehouse_id===w.id).reduce((s,b)=>s+Number(b.quantity),0)})).filter(w=>w.quantity>0),[balances,warehouses,unit]);
 useEffect(()=>{if(open){setSource(fromWarehouseId??stocks[0]?.id??null);setTarget(null);setQty('1');setRecipient('');setDate(format(new Date(),'yyyy-MM-dd'));setDestination(null);setConfirm(false);setKey(crypto.randomUUID());}},[open]); // eslint-disable-line react-hooks/exhaustive-deps
 const {data:objects=[],error:objectError}=useQuery({queryKey:['wh-objects',orgId],enabled:open&&type==='issue',queryFn:()=>warehouseRows<{id:string;name:string}>((f,t)=>supabase.from('request_objects').select('id,name').eq('organization_id',orgId).order('name').range(f,t))});
 const {data:equipment=[],error:equipmentError}=useQuery({queryKey:['wh-equipment',orgId],enabled:open&&type==='issue',queryFn:()=>warehouseRows<{id:string;model:string;plate_number:string|null;brand:string}>((f,t)=>supabase.from('equipment').select('id,model,plate_number,brand').eq('organization_id',orgId).order('model').range(f,t))});
 if(!unit)return null;
 const quantity=Number(qty.replace(',','.'));const available=stocks.find(s=>s.id===source)?.quantity??0;
 const errors:string[]=[];
 if(type==='issue'&&(mode==='equipment'?equipmentError:objectError))errors.push(`Не удалось загрузить справочник: ${(mode==='equipment'?equipmentError:objectError)?.message}`);
 if(!Number.isFinite(quantity)||quantity<=0)errors.push('Количество должно быть больше 0');
 if(quantity>available)errors.push(`Недостаточно остатка: ${available}`);
 if(unit.kind==='item'&&quantity!==1)errors.push('Изделие учитывается поштучно');
 if(!source)errors.push('Нет остатка на складе');
 if(type==='move'&&(!target||target===source))errors.push('Выберите другой склад');
 if(type==='issue')errors.push(...validateSimpleIssue(recipient,date,mode==='equipment'?destination:null,mode==='object'?destination:null));
 const save=async()=>{setBusy(true);try{
  const {error}=await supabase.rpc('simple_warehouse_operation',{_operation_key:key,_unit_id:unit.id,_type:type,_from_warehouse_id:source??'',_to_warehouse_id:target??undefined,_quantity:quantity,_recipient:recipient,_operation_date:date,_equipment_id:type==='issue'&&mode==='equipment'?destination??undefined:undefined,_object_id:type==='issue'&&mode==='object'?destination??undefined:undefined});
  if(error)throw error;await qc.invalidateQueries({queryKey:['wh-qr']});toast({title:type==='move'?'Перемещено':'Выдано'});onOpenChange(false);
 }catch(e){toast({title:'Операция не выполнена',description:(e as {message?:string})?.message??String(e),variant:'destructive'});}finally{setBusy(false);}};
 const destLabel=mode==='object'?objects.find(o=>o.id===destination)?.name:equipment.find(e=>e.id===destination)?.model;
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{type==='move'?'Переместить':'Выдать'} · {unit.name}</DialogTitle></DialogHeader>
 {!confirm?<div className="space-y-3">
 {stocks.length>1?<><Label>Со склада</Label><TaskLookupSelect label="Склад отправления" value={source} onChange={setSource} options={stocks.map(w=>({id:w.id,name:`${w.name} — ${w.quantity} ${unit.unit}`}))}/></>:<p className="text-sm">{stocks[0]?.name??'—'} · остаток {available} {unit.unit}</p>}
 {type==='move'?<><Label>Куда</Label><TaskLookupSelect label="Склад назначения" value={target} onChange={setTarget} options={warehouses.filter(w=>w.id!==source).map(w=>({id:w.id,name:w.name}))}/></>:<>
 <Label htmlFor="recipient">Кому</Label><Input id="recipient" value={recipient} onChange={e=>setRecipient(e.target.value)} className="min-h-11"/>
 <Label htmlFor="issue-date">Когда</Label><Input id="issue-date" type="date" value={date} onChange={e=>setDate(e.target.value)} className="min-h-11"/>
 <div className="flex gap-2"><Button variant={mode==='equipment'?'default':'outline'} className="min-h-11" onClick={()=>{setMode('equipment');setDestination(null);}}>На технику</Button><Button variant={mode==='object'?'default':'outline'} className="min-h-11" onClick={()=>{setMode('object');setDestination(null);}}>Для объекта</Button></div>
 <TaskLookupSelect label={mode==='equipment'?'Техника':'Объект'} value={destination} onChange={setDestination} options={mode==='object'?objects:equipment.map(e=>({id:e.id,name:[e.plate_number,e.model,e.brand].filter(Boolean).join(' • ')}))}/>
 </>}
 {unit.kind==='batch'?<><Label htmlFor="op-quantity">Количество, {unit.unit}</Label><Input id="op-quantity" inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value)} className="min-h-11 font-numeric"/></>:<p>Количество: 1 {unit.unit}</p>}
 {errors.length>0&&<ul className="text-sm text-destructive space-y-1">{errors.map(e=><li key={e}>{e}</li>)}</ul>}
 </div>:<div className="space-y-2 text-sm"><p className="font-medium">{quantity} {unit.unit} · {unit.name}</p><p>Со склада: {warehouses.find(w=>w.id===source)?.name}</p>{type==='move'?<p>Куда: {warehouses.find(w=>w.id===target)?.name}</p>:<><p>Кому: {recipient}</p><p>Когда: {date}</p><p>{mode==='equipment'?'Техника':'Объект'}: {destLabel}</p></>}</div>}
 <DialogFooter className="gap-2">{confirm?<><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>setConfirm(false)}>Назад</Button><Button className="min-h-11" disabled={busy} onClick={save}>{busy?'Сохранение…':'Подтвердить'}</Button></>:<Button className="min-h-11" disabled={errors.length>0} onClick={()=>setConfirm(true)}>Далее</Button>}</DialogFooter>
 </DialogContent></Dialog>;
}
