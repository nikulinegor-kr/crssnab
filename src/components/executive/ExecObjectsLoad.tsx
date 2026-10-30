import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatExecAmount, type ExecObjectLoad } from "@/lib/executivePanel";

export function ExecObjectsLoad({ items, loading, error }: { items: ExecObjectLoad[]; loading: boolean; error: boolean }) {
  return <section className="min-w-0"><h2 className="mb-3 text-base font-semibold">Нагрузка по объектам</h2>
    <div className="min-h-[288px]">{loading ? <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div> : error ?
      <p className="py-8 text-sm text-muted-foreground">Не удалось загрузить объекты</p> : !items.length ? <p className="py-8 text-sm text-muted-foreground">Нет объектов с открытыми заявками или просроченными задачами</p> :
      <div className="divide-y divide-border">{items.map(item => <div key={item.id} className="py-3"><div className="mb-1 flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm font-medium">{item.name}</span><span className="shrink-0 font-mono text-xs tabular-nums">{formatExecAmount(item.amount)}</span></div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums"><span>Заявок: {item.requests}</span><span>Просроченных задач: <span className={item.overdueTasks ? "text-destructive" : ""}>{item.overdueTasks}</span></span></div></div>)}</div>}</div>
    <Button variant="link" asChild className="px-0 text-foreground"><Link to="/objects">Все объекты <ChevronRight /></Link></Button>
  </section>;
}