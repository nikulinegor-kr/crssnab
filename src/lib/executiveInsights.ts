import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import { getStaleDays, isOpenRequest, isOverdueDelivery, isStale } from "./requestStaleness";
import type { ExecAttentionItem } from "./executivePanel";
export interface ExecutiveRequest {
 id:string; description:string; status:string; priority:string|null; created_at:string|null; updated_at?:string|null; executor?:string|null;
 amount?:number|null; amount_2?:number|null; amount_3?:number|null; invoice_number?:string|null; invoice_number_2?:string|null; invoice_number_3?:string|null;
 payment_percent?:number|null; payment_status?:string|null; planned_delivery_date?:string|null; delivery_date?:string|null; actual_arrival_date?:string|null; transport_company?:string|null; object?:{name:string}|null;
}
export const dateKey=(v?:string|null)=>{if(!v)return null;const d=parseISO(v);return isValid(d)?format(d,"yyyy-MM-dd"):null;};
export const plannedArrival=(r:ExecutiveRequest)=>dateKey(r.planned_delivery_date)??dateKey(r.delivery_date);
export const invoiceTotal=(r:ExecutiveRequest)=>[r.amount,r.amount_2,r.amount_3].reduce<number>((s,v)=>s+(typeof v==="number"&&Number.isFinite(v)&&v>=0?v:0),0);
/** payment_percentage is the prepayment PLAN and must never substitute for actual payment. */
export function actualPaymentPercent(r:ExecutiveRequest):number|null{
 if(typeof r.payment_percent==="number")return Number.isFinite(r.payment_percent)&&r.payment_percent>=0&&r.payment_percent<=100?r.payment_percent:null;
 if(["Оплачено","Оплачен"].includes(r.payment_status??""))return 100;
 if(["Не оплачено","Не оплачен"].includes(r.payment_status??""))return 0;
 return null;
}
export const employeeKey=(n?:string|null)=>n?.trim().replace(/\s+/g," ").toLocaleLowerCase("ru-RU").replace(/\s*\.\s*/g,".")||"__unassigned";
export type Decision={id:string;kinds:("payment"|"delivery"|"task"|"stale")[];balance?:number;kind:"payment"|"delivery"|"task"|"stale";title:string;reason:string;meta:string;days:number;urgent:boolean;requestId?:string;taskId?:string};
export function buildExecutiveSnapshot(requests:ExecutiveRequest[],tasks:ExecAttentionItem[],now=new Date()){
 const today=startOfDay(now),day=format(today,"yyyy-MM-dd"),last=format(addDays(today,6),"yyyy-MM-dd"),open=requests.filter(isOpenRequest);
 const finance={total:0,paid:0,outstanding:0,payableRequests:0,unknownPayment:0,unpriced:0};
 const quality:{key:string;label:string;rows:ExecutiveRequest[]}[]=[{key:"date",label:"Без срока поставки",rows:[]},{key:"executor",label:"Без исполнителя",rows:[]},{key:"cost",label:"Без суммы",rows:[]},{key:"payment",label:"Неизвестна оплата",rows:[]}];
 const decisions:Decision[]=tasks.map(t=>({id:`task-${t.id}`,taskId:t.id,kinds:["task"],kind:"task",title:t.title,reason:`Задача просрочена: ${t.days} дн.`,meta:[t.objectName,t.assigneeName||"Не назначен"].filter(Boolean).join(" · "),days:t.days,urgent:["critical","urgent"].includes(t.priority??"")}));
 for(const r of open){
  const total=invoiceTotal(r),pct=actualPaymentPercent(r);finance.total+=total;
  if(!total){finance.unpriced++;quality[2].rows.push(r);}
  if(total&&pct===null){finance.unknownPayment++;quality[3].rows.push(r);}
  const balance=total&&pct!==null?Math.round(total*(100-pct))/100:0;
  if(total&&pct!==null){finance.paid+=total-balance;finance.outstanding+=balance;if(balance>0)finance.payableRequests++;}
  if(!plannedArrival(r)&&!r.actual_arrival_date)quality[0].rows.push(r);
  if(!r.executor?.trim())quality[1].rows.push(r);
  const late=isOverdueDelivery(r,today),input={...r,created_at:r.created_at??r.updated_at??""},inTransit=["В пути","Доставлено в ТК","Отгружено"].includes(r.status),stale=!inTransit&&isStale(input,today);
  const days=late?differenceInCalendarDays(today,parseISO(plannedArrival(r)!)):stale?getStaleDays(input,today):0;
  const kind=late?"delivery":balance>0?"payment":stale?"stale":null;
  if(kind)decisions.push({id:`request-${r.id}`,requestId:r.id,kinds:[...(late?["delivery" as const]:[]),...(balance>0?["payment" as const]:[]),...(stale?["stale" as const]:[])],balance,kind,title:r.description,reason:late?`Доставка задерживается: ${days} дн.`:kind==="payment"?"Остаток к оплате":`Без изменений: ${days} дн.`,meta:[r.object?.name,r.executor||"Не назначен",kind==="payment"?`${balance.toLocaleString("ru-RU",{maximumFractionDigits:2})} ₽`:r.transport_company].filter(Boolean).join(" · "),days,urgent:["Аварийно","critical","urgent"].includes(r.priority??"")});
 }
 decisions.sort((a,b)=>Number(b.urgent)-Number(a.urgent)||Number(b.kind==="delivery"||b.kind==="task")-Number(a.kind==="delivery"||a.kind==="task")||b.days-a.days||a.id.localeCompare(b.id));
 const upcoming=open.filter(r=>!r.actual_arrival_date&&plannedArrival(r)&&plannedArrival(r)!>=day&&plannedArrival(r)!<=last).sort((a,b)=>plannedArrival(a)!.localeCompare(plannedArrival(b)!)||a.id.localeCompare(b.id));
 return{open,finance,quality,decisions,upcoming};
}
export function buildExecutiveTeam(open:ExecutiveRequest[],completed:ExecutiveRequest[],tasks:ExecAttentionItem[]){
 const teams=new Map<string,{key:string;name:string;open:number;overdueTasks:number;completed:number;assessed:number;onTime:number}>();
 const get=(name?:string|null)=>{const key=employeeKey(name);if(!teams.has(key))teams.set(key,{key,name:name?.trim()||"Без исполнителя",open:0,overdueTasks:0,completed:0,assessed:0,onTime:0});return teams.get(key)!;};
 for(const r of open.filter(isOpenRequest))get(r.executor).open++;
 for(const t of tasks)get(t.assigneeName).overdueTasks++;
 for(const r of completed){if(!["Доставлено","Выполнено"].includes(r.status))continue;const a=dateKey(r.actual_arrival_date),p=plannedArrival(r),c=dateKey(r.created_at);if(!a)continue;const m=get(r.executor);m.completed++;if(p&&(!c||a>=c)&&(!c||p>=c)){m.assessed++;if(a<=p)m.onTime++;}}
 return[...teams.values()].sort((a,b)=>b.overdueTasks-a.overdueTasks||b.open-a.open||a.name.localeCompare(b.name,"ru"));
}
