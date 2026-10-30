import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/useMe";
import type { PlannerTask } from "@/hooks/usePlannerTasks";
import { TaskStatusActions } from "@/components/tasks/TaskStatusActions";
import { MeSection, MeEmpty } from "@/components/me/MeSection";
import { MeNotificationsList } from "@/components/me/MeNotificationsList";
import { execRequestLink } from "@/lib/executivePanel";
const TaskDialog=lazy(()=>import("@/components/planner/PlannerTaskDialog").then(m=>({default:m.PlannerTaskDialog})));
export default function MePage(){
 const me=useMe();const [task,setTask]=useState<PlannerTask|null>(null);
 const tasks=me.tasks.data??[];const requests=me.requests.data??[];
 const overdue=tasks.filter(t=>t.due_date&&new Date(t.due_date)<me.today).length;
 const todayTasks=tasks.filter(t=>t.due_date&&format(new Date(t.due_date),"yyyy-MM-dd")===format(me.today,"yyyy-MM-dd")).length;
 const metrics=[{title:"Просрочено",value:overdue,loading:me.tasks.isLoading,error:me.tasks.isError,url:"/tasks?tab=mine&overdue=1",red:true},{title:"На сегодня",value:todayTasks,loading:me.tasks.isLoading,error:me.tasks.isError,url:"/tasks?tab=mine&today=1",red:false},{title:"Ждут приёмки",value:me.reviews.data,loading:me.reviews.isLoading,error:me.reviews.isError,url:"/tasks?tab=control",red:false},{title:"Заявки в работе",value:requests.length,loading:me.requests.isLoading,error:me.requests.isError,url:"/requests?mine=1&open=1",red:false}];
 const upcoming=[...tasks.filter(t=>t.due_date&&new Date(t.due_date)>=me.today&&new Date(t.due_date)<me.end).map(t=>({id:t.id,title:t.title,date:t.due_date??"",task:t,link:null as string|null})),...(me.calendar.data??[]).map(e=>({id:e.id,title:e.title,date:e.start_date,task:null,link:e.request_id?execRequestLink(e.request_id):"/calendar"}))].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const days=[...new Set(upcoming.map(i=>format(new Date(i.date),"yyyy-MM-dd")))];
 const person=me.identity.data;
 return <div className="mx-auto min-w-0 max-w-6xl space-y-4 pb-[env(safe-area-inset-bottom)] text-foreground">
 <header className="flex min-w-0 items-center gap-3 py-2"><Avatar className="h-14 w-14 shrink-0"><AvatarFallback className="bg-muted text-lg font-semibold">{person?.full_name?.split(/\s+/).slice(0,2).map(n=>n[0]).join("")||"—"}</AvatarFallback></Avatar><div className="min-w-0 flex-1">{me.identity.isLoading?<Skeleton className="h-6 w-40"/>:<h1 className="break-words text-xl font-semibold">{person?.full_name||"Личный кабинет"}</h1>}{person?.position&&<p className="truncate text-sm text-muted-foreground">{person.position}</p>}<p className="truncate text-xs text-muted-foreground">{person?.organization||"—"}{person?.department?` · ${person.department}`:""}</p></div><Button variant="ghost" size="icon" asChild className="h-11 w-11 shrink-0" aria-label="Мой профиль"><Link to="/me/profile"><Settings/></Link></Button></header>
 <MeSection title="Сегодня" rows={2}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(m=><Button key={m.title} variant="outline" asChild className="h-20 min-w-0 flex-col items-start justify-center px-3"><Link to={m.url}><span className="whitespace-normal text-xs text-muted-foreground">{m.title}</span>{m.loading?<Skeleton className="h-7 w-10"/>:<span className={`text-2xl tabular-nums ${m.red&&(m.value??0)>0?"text-destructive":"text-foreground"}`}>{m.error?"—":m.value??"—"}</span>}</Link></Button>)}</div></MeSection>
 <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
 <MeSection title="Мои задачи" link="/tasks?tab=mine" loading={me.tasks.isLoading} error={me.tasks.isError} rows={5}>{!tasks.length?<MeEmpty>Активных задач нет</MeEmpty>:<div className="divide-y divide-border">{tasks.slice(0,5).map(t=><div key={t.id} className="min-w-0 py-2"><Button variant="ghost" className="h-auto min-h-11 w-full flex-col items-start gap-0 px-0 py-1 text-left" onClick={()=>setTask(t)}><span className="block max-w-full truncate text-sm">{t.title}</span><span className={`text-xs font-normal ${t.due_date&&new Date(t.due_date)<me.today?"text-destructive":"text-muted-foreground"}`}>{t.due_date?format(new Date(t.due_date),"d MMMM",{locale:ru}):"Без срока"}</span></Button><TaskStatusActions task={t} primary onUpdated={()=>void me.tasks.refetch()}/></div>)}</div>}</MeSection>
 <MeSection title="Мои заявки" link="/requests?mine=1" loading={me.requests.isLoading} error={me.requests.isError} rows={5}>{!requests.length?<MeEmpty>Открытых заявок нет</MeEmpty>:<div className="divide-y divide-border">{requests.slice(0,5).map(r=><Button key={r.id} variant="ghost" asChild className="h-auto min-h-14 w-full flex-col items-start gap-1 px-0 py-2 text-left"><Link to={execRequestLink(r.id)}><span className="max-w-full truncate text-sm">{r.description}</span><span className="max-w-full truncate text-xs font-normal text-muted-foreground">{r.request_number.replace(/^REQ-/,"")} · {r.status}</span></Link></Button>)}</div>}</MeSection>
 <MeSection title="Мои согласования"><MeEmpty>Согласования появятся после настройки маршрутов согласования</MeEmpty></MeSection>
 <MeNotificationsList/>
 <MeSection title="Ближайшие 7 дней" loading={me.tasks.isLoading||me.calendar.isLoading} error={me.tasks.isError||me.calendar.isError} rows={7}>{!upcoming.length?<MeEmpty>Ближайших событий нет</MeEmpty>:<div className="space-y-3">{days.map(day=><div key={day}><h3 className="text-xs font-semibold text-muted-foreground">{format(new Date(day+"T12:00:00"),"EEEE, d MMMM",{locale:ru})}</h3>{upcoming.filter(i=>format(new Date(i.date),"yyyy-MM-dd")===day).map(i=>i.task?<Button key={`task-${i.id}`} variant="ghost" className="min-h-11 w-full justify-start px-0 text-left" onClick={()=>setTask(i.task)}><span className="truncate">{i.title}</span></Button>:<Button key={`event-${i.id}`} variant="ghost" asChild className="min-h-11 w-full justify-start px-0 text-left"><Link to={i.link??"/calendar"}><span className="truncate">{i.title}</span></Link></Button>)}</div>)}</div>}</MeSection>
 <MeSection title="Моя статистика за 30 дней" loading={me.stats.isLoading} error={me.stats.isError} rows={3}><dl className="grid grid-cols-2 gap-4">{[{label:"Выполнено задач",value:me.stats.data?.completed??0},{label:"В срок",value:me.stats.data?.onTime==null?"—":`${me.stats.data.onTime}%`},{label:"Среднее выполнение",value:me.stats.data?.averageDays==null?"—":`${me.stats.data.averageDays.toFixed(1)} дн.`},{label:"Возвраты на доработку",value:me.stats.data?.rework??0}].map(i=><div key={i.label}><dt className="text-xs text-muted-foreground">{i.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{i.value}</dd></div>)}</dl></MeSection>
 </div>{task&&<Suspense fallback={<Skeleton className="h-20"/>}><TaskDialog open task={task} onOpenChange={open=>{if(!open){setTask(null);void me.tasks.refetch();void me.reviews.refetch();void me.stats.refetch();}}}/></Suspense>}
 </div>;
}
