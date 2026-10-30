import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { normalizeNotificationLink } from "@/lib/notificationLinks";
import { useMyNotifications } from "@/hooks/useMyNotifications";
import { MeSection,MeEmpty } from "./MeSection";
export function MeNotificationsList({page=0,pageSize=10,full=false}:{page?:number;pageSize?:number;full?:boolean}){
 const {list,mark}=useMyNotifications(page,pageSize);const navigate=useNavigate();
 const rows=list.data?.rows??[];
 return <MeSection title="Уведомления" link={full?undefined:"/me/notifications"} loading={list.isLoading} error={list.isError} rows={10}>
 <Button variant="link" className="min-h-11 px-0 text-xs" disabled={mark.isPending || !rows.some(n=>!n.is_read)} onClick={()=>mark.mutate(undefined)}>Прочитать все</Button>
 {!rows.length?<MeEmpty>Уведомлений пока нет</MeEmpty>:<div className="divide-y divide-border">{rows.map(n=><Button key={n.id} variant="ghost" className="h-auto min-h-14 w-full items-start justify-start gap-2 rounded-none px-0 py-3 text-left" onClick={()=>{mark.mutate(n.id);navigate(normalizeNotificationLink(n.link));}}>
 <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read?"bg-transparent":"bg-primary"}`} aria-label={n.is_read?"Прочитано":"Не прочитано"}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{n.title}</span><span className="block truncate text-xs font-normal text-muted-foreground">{n.message}</span><time className="block text-xs font-normal text-muted-foreground tabular-nums">{format(new Date(n.created_at),"dd.MM HH:mm")}</time></span>
 </Button>)}</div>}
 {full&&<p className="mt-2 text-xs text-muted-foreground">{list.data?.count??0} уведомлений</p>}
 </MeSection>;
}
