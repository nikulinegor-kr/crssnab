import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXEC_LINKS, execRequestLink, type ExecAttentionGroup } from "@/lib/executivePanel";

export function ExecAttentionList({ groups, loading, error, onOpenTask }: { groups: ExecAttentionGroup[]; loading: boolean; error: boolean; onOpenTask: (id: string) => void }) {
  const visible = groups.filter(group => group.count > 0);
  return <section id="executive-attention" className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
    <h2 className="mb-2 text-[15px] font-semibold">Требует внимания</h2>
    {loading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-1"><Skeleton className="h-11 w-full" />{Array.from({ length: 3 }, (_, j) => <Skeleton key={j} className="h-11 w-full" />)}<Skeleton className="h-11 w-20" /></div>)}</div> : error ?
      <p className="py-4 text-sm text-muted-foreground">Не удалось загрузить список</p> : !visible.length ? <p className="py-4 text-sm text-muted-foreground">Всё под контролем</p> :
      <div className="divide-y divide-border">{visible.map(group => <div key={group.key} className="py-1">
        <Button variant="link" asChild className="h-auto min-h-11 w-full justify-start px-0 text-left text-sm text-foreground"><Link to={EXEC_LINKS[group.key]}>{group.title} ({group.count})</Link></Button>
        <div>{group.items.slice(0, 3).map(item => {
          const content = <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title || "—"}</span><span className="block truncate text-xs font-normal text-muted-foreground">{[item.reference, item.objectName, item.assigneeName].filter(Boolean).join(" · ") || "—"}</span></span><span className={`shrink-0 text-xs font-normal tabular-nums ${group.overdue ? "text-destructive" : "text-muted-foreground"}`}>{item.days} дн.</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></>;
          const className = "h-auto min-h-11 w-full justify-start gap-2 rounded-md px-0 py-1.5 text-left";
          return item.kind === "task" ? <Button key={item.id} variant="ghost" className={className} onClick={() => onOpenTask(item.id)}>{content}</Button> : <Button key={item.id} variant="ghost" asChild className={className}><Link to={execRequestLink(item.id)}>{content}</Link></Button>;
        })}</div>
        <Button variant="link" asChild className="min-h-11 px-0 text-xs text-muted-foreground"><Link to={EXEC_LINKS[group.key]}>Все {group.count} →</Link></Button>
      </div>)}</div>}
  </section>;
}
