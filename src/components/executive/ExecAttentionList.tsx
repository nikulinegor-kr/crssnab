import { Link } from "react-router-dom";
import { ListChecks, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecAttentionItem } from "@/lib/executivePanel";

export function ExecAttentionList({ items, loading, error, onOpenTask }: { items: ExecAttentionItem[]; loading: boolean; error: boolean; onOpenTask: (id: string) => void }) {
  return <section id="executive-attention" className="min-w-0 scroll-mt-4">
    <h2 className="mb-3 text-base font-semibold">Требует внимания</h2>
    <div className="min-h-[480px]">
      {loading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[72px] w-full" />)}</div> : error ?
        <p className="py-8 text-sm text-muted-foreground">Не удалось загрузить список</p> : !items.length ? <p className="py-8 text-sm text-muted-foreground">Просроченных задач нет</p> :
        <div className="divide-y divide-border">{items.map(item => {
          const Icon = item.kind === "task" ? ListChecks : FileText;
          const content = <><Icon className="mt-1 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 font-medium">{item.title || "—"}</span>
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{[item.reference, item.objectName, item.assigneeName].filter(Boolean).join(" · ") || "—"}</span></span>
            <span className={`shrink-0 text-right text-xs font-normal tabular-nums ${item.kind === "task" ? "text-destructive" : "text-muted-foreground"}`}><span className="block font-semibold">{item.days} дн.</span><span className="block">{item.kind === "task" ? "просрочка" : "без движения"}</span></span><ChevronRight className="text-muted-foreground" /></>;
          const className = "h-auto min-h-[72px] w-full items-start justify-start rounded-none px-0 py-3 text-left whitespace-normal";
          return item.kind === "task" ? <Button key={`task-${item.id}`} variant="ghost" className={className} onClick={() => onOpenTask(item.id)}>{content}</Button> :
            <Button key={`request-${item.id}`} variant="ghost" asChild className={className}><Link to={`/requests/${item.id}`}>{content}</Link></Button>;
        })}</div>}
    </div>
    <Button variant="link" asChild className="px-0 text-foreground"><Link to="/planner/tasks">Все <ChevronRight /></Link></Button>
  </section>;
}