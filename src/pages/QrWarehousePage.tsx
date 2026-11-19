import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, QrCode, ScanLine, ArrowRightLeft, PackageMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AddWarehouseDialog } from '@/components/warehouse-qr/AddWarehouseDialog';
import { CameraScanDialog } from '@/components/warehouse-qr/CameraScanDialog';
import { OperationDialog } from '@/components/warehouse-qr/OperationDialog';
import { warehouseRows, loadUnitLabelPeople } from '@/lib/simpleWarehouse';
import { parseQrInput } from '@/lib/warehouseQr';
import { ManualReceiptDialog } from '@/components/warehouse-qr/ManualReceiptDialog';
import { WarehouseJournal } from '@/components/warehouse-qr/WarehouseJournal';
import { IssuedView } from '@/components/warehouse-qr/IssuedView';
import { InventoryDialog } from '@/components/warehouse-qr/InventoryDialog';
import { IssueActionsDialog, type ActionIssue } from '@/components/warehouse-qr/IssueActionsDialog';
import { issueSplit, fmtQty } from '@/lib/issueStatus';
import { Link } from 'react-router-dom';
import { LabelExporter } from '@/components/warehouse-qr/LabelExporter';
import type { LabelPeople } from '@/lib/labelPeople';
import { WarehouseWorkspace } from '@/components/warehouse-qr/WarehouseWorkspace';
import type { WarehouseProduct } from '@/lib/warehouseView';
import type { WhBalance, WhUnit, WhWarehouse } from '@/components/warehouse-qr/types';
export default function QrWarehousePage(){
 const {currentOrgId:org}=useCurrentOrganization();const {toast}=useToast();const [params,setParams]=useSearchParams();
 const navigate=useNavigate(),qc=useQueryClient();
 const [editing,setEditing]=useState<{id:string;name:string;description:string|null}|null>(null),[deleting,setDeleting]=useState<{id:string;name:string;archived_at?:string|null}|null>(null),[deleteBusy,setDeleteBusy]=useState(false),[deleteError,setDeleteError]=useState('');
 const {data:canDelete=false}=useQuery({queryKey:['wh-delete-permission',org],enabled:!!org,queryFn:async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user||!org)return false;const {data,error}=await supabase.rpc('user_is_org_admin',{_user_id:user.id,_org_id:org});if(error)throw error;return data===true;}});
 const remove=async()=>{if(!deleting||!org||deleteBusy)return;setDeleteBusy(true);setDeleteError('');try{const {error}=await supabase.rpc('set_warehouse_archived',{_warehouse_id:deleting.id,_archived:!deleting.archived_at});if(error)throw error;await Promise.all([qc.invalidateQueries({queryKey:['wh-qr']}),qc.invalidateQueries({queryKey:['warehouses']})]);toast({title:deleting.archived_at?'Склад возвращён из архива':'Склад перенесён в архив'});setDeleting(null);}catch(e){setDeleteError((e as Error).message);}finally{setDeleteBusy(false);}};
 const [scan,setScan]=useState('');const [camera,setCamera]=useState(false);const [scanner,setScanner]=useState(false);const warehouse=params.get('warehouse');const [adding,setAdding]=useState(false);
 const chooseWarehouse=(id:string|null)=>{setParams(previous=>{const next=new URLSearchParams(previous);next.delete('qr');if(id)next.set('warehouse',id);else next.delete('warehouse');return next;});};
 const [card,setCard]=useState<WhUnit|null>(null);const [source,setSource]=useState<string|undefined>();const [op,setOp]=useState<'move'|'issue'|null>(null);const [operationUnit,setOperationUnit]=useState<WhUnit|null>(null);
 const [manual,setManual]=useState(false);const [inventory,setInventory]=useState(false);const [action,setAction]=useState<ActionIssue|null>(null);
 const [exportUnits,setExportUnits]=useState<WhUnit[]>([]);
 const [printBusy,setPrintBusy]=useState(false),[printError,setPrintError]=useState(''),[labelPeople,setLabelPeople]=useState<Map<string,LabelPeople>>(new Map());
 const {data:allowed=false,isLoading:permissionLoading,error:permissionError}=useQuery({queryKey:['wh-permission',org],enabled:!!org,queryFn:async()=>{if(!org)return false;const {data:{user}}=await supabase.auth.getUser();if(!user)return false;const {data,error}=await supabase.rpc('user_can_use_qr_warehouse',{_user:user.id,_org:org});if(error)throw error;return data===true;}});
 const enabled=!!org&&allowed;
 const {data:warehouses=[],error:we,isLoading:warehousesLoading}=useQuery({queryKey:['wh-qr','warehouses',org],enabled,queryFn:()=>warehouseRows<WhWarehouse&{description:string|null;archived_at:string|null;request_objects:{name:string}|null}>((f,t)=>supabase.from('warehouses').select('id,name,description,archived_at,request_objects!warehouses_object_id_fkey(name)').eq('organization_id',org??'').order('name').range(f,t))});
 const {data:units=[],error:ue,isLoading}=useQuery({queryKey:['wh-qr','units',org],enabled,queryFn:()=>warehouseRows<WhUnit>((f,t)=>supabase.from('warehouse_units').select('id,kind,name,request_title,request_number,source_request_id,serial_number,batch_number,unit,qr_token,product_id,created_at').eq('organization_id',org??'').order('created_at',{ascending:false}).range(f,t))});
 const {data:balances=[],error:be,isLoading:balancesLoading}=useQuery({queryKey:['wh-qr','balances',org],enabled,queryFn:()=>warehouseRows<WhBalance>((f,t)=>supabase.from('warehouse_balances').select('id,unit_id,warehouse_id,cell_id,quantity').eq('organization_id',org??'').gt('quantity',0).order('id').range(f,t))});
 const {data:products=[],error:productError,isLoading:productsLoading}=useQuery({queryKey:['wh-qr','products',org],enabled,queryFn:()=>warehouseRows<WarehouseProduct>((f,t)=>supabase.from('warehouse_products').select('id,article,category,min_stock,unit').eq('organization_id',org??'').order('id').range(f,t))});
 const {data:damaged=[]}=useQuery({queryKey:['wh-qr','damaged',org],enabled,queryFn:()=>warehouseRows<{unit_id:string;warehouse_id:string;quantity:number}>((f,t)=>supabase.from('warehouse_damaged_balances').select('unit_id,warehouse_id,quantity').eq('organization_id',org??'').gt('quantity',0).order('id').range(f,t))});
 const {data:cardInfo}=useQuery({queryKey:['wh-qr','unit-card',card?.id],enabled:!!card,queryFn:async()=>{const [iss,req]=await Promise.all([supabase.from('warehouse_issues').select('id,organization_id,unit_id,warehouse_id,recipient_name,recipient_user_id,equipment_id,object_id,operation_date,created_at,issued_qty,returned_qty,installed_qty,consumed_qty,note,received_confirmed_at,received_confirmed_proxy').eq('unit_id',card?.id??'').order('created_at',{ascending:false}).limit(100),card?.source_request_id?supabase.from('requests').select('id,description,request_number').eq('id',card.source_request_id).maybeSingle():Promise.resolve({data:null,error:null})]);if(iss.error)throw iss.error;if(req.error)throw req.error;return {issues:(iss.data??[]) as ActionIssue[],request:req.data as {id:string;description:string|null;request_number:string}|null};}});
 const openCode=(raw:string)=>{setScanner(false);const code=parseQrInput(raw);if(code?.kind==='request'){navigate(`/requests?request=${encodeURIComponent(code.token)}`,{state:{qrEntry:true}});return;}const unit=code?.kind!=='cell'?units.find(u=>u.qr_token===code?.token):null;if(unit){setCard(unit);setSource(undefined);}else toast({title:code?'ТМЦ не найдена в вашей организации':'Код не распознан',variant:'destructive'});};
 useEffect(()=>{const code=params.get('qr');if(code&&(parseQrInput(code)?.kind==='request'||units.length)){openCode(code);}},[params,units]); // eslint-disable-line react-hooks/exhaustive-deps
 const stocks=(id:string)=>warehouses.map(w=>({...w,quantity:balances.filter(b=>b.unit_id===id&&b.warehouse_id===w.id).reduce((s,b)=>s+Number(b.quantity),0)})).filter(w=>w.quantity>0);
 const currentWarehouse=warehouses.find(w=>w.id===warehouse);
 const label=(u:WhUnit)=>({kind:'unit' as const,token:u.qr_token,title:u.request_title||u.name,...labelPeople.get(u.id),lines:[u.name,u.batch_number??'',u.serial_number??'',u.kind==='item'?`Изделие · ${u.unit}`:`Материал · ${u.unit}`]});
 const print=async(u:WhUnit[])=>{if(!org||printBusy)return;setExportUnits(u);setPrintBusy(true);setPrintError('');try{setLabelPeople(await loadUnitLabelPeople(u.map(x=>x.id),org));}catch(e){setPrintError((e as Error).message);}finally{setPrintBusy(false);}};
 if(permissionLoading)return <p className="p-4">Загрузка…</p>;
 if(permissionError)return <p role="alert" className="text-destructive p-4">Не удалось проверить доступ: {permissionError.message}</p>;
 if(!allowed)return <div className="p-4"><h1 className="text-xl font-semibold">Нет доступа к складу</h1><p className="text-muted-foreground mt-2">Требуется существующее право «Склад».</p></div>;
 return <div className="min-w-0 w-full">
 <WarehouseWorkspace
   warehouses={warehouses} units={units} balances={balances} products={products} warehouseId={warehouse}
   loading={warehousesLoading||isLoading||balancesLoading||productsLoading}
   error={(we??ue??be??productError)?.message}
   onRetry={()=>qc.invalidateQueries({queryKey:['wh-qr']})}
   canArchive={canDelete} onChoose={chooseWarehouse} onAdd={()=>setAdding(true)} onEdit={setEditing}
   onArchive={w=>{setDeleteError('');setDeleting(w);}}
   onScan={()=>setScanner(true)} onReceive={()=>setManual(true)} onIssue={()=>{setOperationUnit(null);setSource(warehouse??undefined);setOp('issue');}} onInventory={()=>setInventory(true)}
   onUnit={u=>{setCard(u);setSource(warehouse??undefined);}} onLabels={print} labelsBusy={printBusy}
   issued={org&&<IssuedView orgId={org} warehouseId={warehouse??undefined}/>}
   journal={org&&<WarehouseJournal orgId={org} units={units} warehouses={warehouses} warehouseId={warehouse??undefined}/>}
 />
 <Dialog open={scanner} onOpenChange={setScanner}><DialogContent className="max-w-md" onOpenAutoFocus={e=>e.preventDefault()}><DialogHeader><DialogTitle>Сканировать QR</DialogTitle></DialogHeader>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();openCode(scan);setScan('');}}>
     <label className="relative block"><ScanLine className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input value={scan} onChange={e=>setScan(e.target.value)} aria-label="QR или код ТМЦ" placeholder="QR или код ТМЦ" className="pl-9 min-h-11 text-base"/></label>
     <div className="grid grid-cols-2 gap-2"><Button className="min-h-11" disabled={!scan.trim()} type="submit">Открыть код</Button><Button type="button" variant="outline" className="min-h-11 gap-2" onClick={()=>{setScanner(false);setCamera(true);}}><Camera className="h-4 w-4"/>Камера</Button></div>
   </form>
 </DialogContent></Dialog>
 {currentWarehouse&&<ManualReceiptDialog open={manual} onOpenChange={setManual} warehouseId={currentWarehouse.id} warehouseName={currentWarehouse.name}/>}
 <CameraScanDialog open={camera} onOpenChange={setCamera} onResult={openCode}/>
 <Dialog open={exportUnits.length>0} onOpenChange={v=>{if(!v)setExportUnits([]);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>QR-наклейки</DialogTitle></DialogHeader><>{printBusy?<p>Загрузка заявителя и приёмщика…</p>:printError?<p role="alert" className="text-destructive">{printError}</p>:<LabelExporter labels={exportUnits.map(label)}/>}</></DialogContent></Dialog>
 <Dialog open={!!card} onOpenChange={v=>{if(!v){setCard(null);setOp(null);}}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">{card&&<><DialogHeader><DialogTitle className="flex gap-2 items-start"><QrCode className="h-5 w-5 shrink-0"/>{card.name}</DialogTitle></DialogHeader><p className="text-muted-foreground text-sm break-words">{cardInfo?.request?<Link className="underline-offset-2 hover:underline text-primary" to={`/requests?request=${cardInfo.request.id}`}>Заявка: {cardInfo.request.description||cardInfo.request.request_number}</Link>:card.source_request_id?'Из заявки':'Ручное оприходование'} · {(card.serial_number??card.batch_number??'—').replace(/^REQ-/,'')} · {card.unit}</p><p className="text-xs text-muted-foreground break-all">Постоянный QR ТМЦ: {card.qr_token}</p><div className="space-y-2">{stocks(card.id).length?stocks(card.id).map(w=><div key={w.id} className="flex justify-between gap-3"><span>{w.name}</span><span className="font-numeric shrink-0">{w.quantity} {card.unit}</span></div>):<p>Остаток: 0 {card.unit}</p>}{damaged.filter(d=>d.unit_id===card.id).map(d=><div key={d.warehouse_id} className="flex justify-between gap-3 text-destructive text-sm"><span>Повреждено · {warehouses.find(w=>w.id===d.warehouse_id)?.name}</span><span className="font-numeric">{fmtQty(Number(d.quantity))} {card.unit}</span></div>)}</div>
 {(cardInfo?.issues??[]).some(i=>issueSplit(i).outstanding>0)&&<div className="border-t pt-3 space-y-2"><h2 className="text-sm font-medium">Выдано и числится</h2>{cardInfo!.issues.filter(i=>issueSplit(i).outstanding>0).map(i=><div key={i.id} className="flex gap-2 items-center text-sm"><span className="flex-1 min-w-0 break-words">{i.recipient_name} · <span className="font-numeric">{fmtQty(issueSplit(i).outstanding)} {card.unit}</span>{i.received_confirmed_at?' · Получил ✓':''}</span><Button variant="outline" className="min-h-11" onClick={()=>setAction(i)}>Возврат / расход</Button></div>)}</div>}
 <DialogFooter className="gap-2 sm:justify-start"><Button className="min-h-11" disabled={!stocks(card.id).length} onClick={()=>{setOperationUnit(card);setCard(null);setOp('move');}}><ArrowRightLeft className="h-4 w-4 mr-2"/>Переместить</Button><Button className="min-h-11" disabled={!stocks(card.id).length} onClick={()=>{setOperationUnit(card);setCard(null);setOp('issue');}}><PackageMinus className="h-4 w-4 mr-2"/>Выдать</Button></DialogFooter>
 {org&&<div className="border-t pt-3 space-y-2"><h2 className="text-sm font-medium">История операций</h2><WarehouseJournal orgId={org} units={units} warehouses={warehouses} unitId={card.id}/></div>}
 </>}</DialogContent></Dialog>
 {org&&<IssueActionsDialog orgId={org} open={!!action} onOpenChange={v=>{if(!v)setAction(null);}} issue={action} unitName={card?.name??''} unit={card?.unit??''}/>}
 {currentWarehouse&&<InventoryDialog open={inventory} onOpenChange={setInventory} warehouseId={currentWarehouse.id} warehouseName={currentWarehouse.name} units={units}/>}
 {org&&<OperationDialog open={!!op} onOpenChange={v=>{if(!v){setOp(null);setOperationUnit(null);}}} orgId={org} type={op??'move'} unit={operationUnit} units={units} warehouses={warehouses} balances={balances} fromWarehouseId={source}/>}
 {org&&<AddWarehouseDialog open={adding||!!editing} onOpenChange={v=>{if(!v){setAdding(false);setEditing(null);}}} orgId={org} warehouse={editing}/>}
 <Dialog open={!!deleting} onOpenChange={v=>{if(!v&&!deleteBusy)setDeleting(null);}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{deleting?.archived_at?'Вернуть из архива':'Перенести в архив'} склад «{deleting?.name}»?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{deleting?.archived_at?'Склад снова станет доступен для движений.':'Архив возможен только без остатков и незавершённых операций. История сохранится, новые движения будут запрещены.'}</p>{deleteError&&<p role="alert" className="text-destructive text-sm">{deleteError}</p>}<DialogFooter><Button variant="outline" className="min-h-11" disabled={deleteBusy} onClick={()=>setDeleting(null)}>Отмена</Button><Button className="min-h-11" disabled={deleteBusy} onClick={remove}>{deleteBusy?'Сохранение…':deleting?.archived_at?'Вернуть':'В архив'}</Button></DialogFooter></DialogContent></Dialog>
 </div>;
}
