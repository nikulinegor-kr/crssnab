import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecEvent } from "@/lib/executivePanel";

export function ExecRecentEvents({ items, loading, error, onOpenTask }: { items: ExecEvent[]; loading: boolean; error: boolean; onOpenTask: (id: string) => void }) {
  return <section className="min-w-0"><h2 className="mb-3 text-base font-semibold">Последние события</h2>
    <div className="min-h-[400px]">{loading ? <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}</div> : error ?
      <p className="py-8 text-sm text-muted-foreground">Не удалось загрузить события</p> : !items.length ? <p className="py-8 text-sm text-muted-foreground">Событий пока нет</p> :
      <div className="divide-y divide-border">{items.map(item => {
        const content = <span className="block w-full min-w-0"><span className="block line-clamp-2 text-sm font-normal">{item.description}</span><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{item.reference} · {item.actor}</span><span className="mt-1 block text-xs font-normal text-muted-foreground tabular-nums">{formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true, locale: ru })}</span></span>;
        const className = "h-auto min-h-[80px] w-full justify-start rounded-none px-0 py-3 text-left whitespace-normal";
        return item.kind === "task" ? <Button key={item.id} variant="ghost" className={className} onClick={() => onOpenTask(item.entityId)}>{content}</Button> : <Button key={item.id} variant="ghost" asChild className={className}><Link to={`/requests/${item.entityId}`}>{content}</Link></Button>;
      })}</div>}</div>
  </section>;
}