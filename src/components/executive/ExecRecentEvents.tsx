import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { execRequestLink, type ExecEvent } from "@/lib/executivePanel";

export function ExecRecentEvents({ items, loading, error, onOpenTask }: { items: ExecEvent[]; loading: boolean; error: boolean; onOpenTask: (id: string) => void }) {
  return <section className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-4"><h2 className="mb-2 text-[15px] font-semibold">Последние события</h2>
    {loading ? <div>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="my-1 h-11 sm:h-8" />)}</div> : error ?
      <p className="py-4 text-sm text-muted-foreground">Не удалось загрузить события</p> : !items.length ? <p className="py-4 text-sm text-muted-foreground">Событий пока нет</p> :
      <div className="divide-y divide-border">{items.map(item => {
        const content = <><span className="min-w-0 flex-1 truncate text-xs font-normal" title={`${item.actor} — ${item.description} — ${item.reference}`}><span className="font-medium">{item.actor}</span> — {item.description} — <span className="text-muted-foreground">{item.reference}</span></span><time dateTime={item.createdAt} className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{formatDistanceToNowStrict(new Date(item.createdAt), { locale: ru })}</time></>;
        const className = "h-auto min-h-11 sm:min-h-8 w-full justify-start gap-2 rounded-none px-0 py-1 text-left";
        return item.kind === "task" ? <Button key={item.id} variant="ghost" className={className} onClick={() => onOpenTask(item.entityId)}>{content}</Button> : <Button key={item.id} variant="ghost" asChild className={className}><Link to={execRequestLink(item.entityId)}>{content}</Link></Button>;
      })}</div>}
  </section>;
}
