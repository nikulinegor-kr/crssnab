import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatExecAmount, formatExecFullAmount, execObjectRequestsLink, execObjectTasksLink, type ExecObjectLoad } from "@/lib/executivePanel";

export function ExecObjectsLoad({ items, loading, error }: { items: ExecObjectLoad[]; loading: boolean; error: boolean }) {
  const max = Math.max(0, ...items.map(item => item.amount));
  return <section className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5"><h2 className="mb-2 text-[15px] font-semibold">Нагрузка по объектам</h2>
    {loading ? <div className="space-y-1">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[54px]" />)}</div> : error ?
      <p className="py-4 text-sm text-muted-foreground">Не удалось загрузить объекты</p> : !items.length ? <p className="py-4 text-sm text-muted-foreground">Нет объектов с открытыми заявками или просроченными задачами</p> :
      <div>{items.map(item => <div key={item.id} className="relative min-w-0 py-1">
        <Link to={execObjectRequestsLink(item.id)} className="flex min-h-11 min-w-0 items-start justify-between gap-2 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${item.name}: ${item.requests} заявок`}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block text-xs text-muted-foreground tabular-nums">{item.requests} заявок</span></span>
          <span className="shrink-0 text-sm tabular-nums" title={formatExecFullAmount(item.amount)}>{formatExecAmount(item.amount)}</span>
        </Link>
        <Button variant="link" asChild className={`absolute bottom-2.5 left-[72px] min-h-11 px-1 text-xs font-normal tabular-nums ${item.overdueTasks > 0 ? "text-destructive" : "text-muted-foreground"}`}><Link to={execObjectTasksLink(item.id)}>· {item.overdueTasks} просрочено</Link></Button>
        <Progress value={max > 0 ? Math.max(0, item.amount / max * 100) : 0} className="h-0.5 bg-muted [&>div]:bg-foreground/20" />
      </div>)}</div>}
  </section>;
}
