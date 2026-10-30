import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXEC_LINKS } from "@/lib/executivePanel";
import { pluralRu } from "@/lib/pluralRu";

type Metric = { data?: number; isLoading: boolean; isError: boolean };
export function ExecKpiTiles({ activeTasks, newRequests, oldNewRequests, staleRequests, overdueTasks, overdueDeliveries }: {
  activeTasks: Metric; newRequests: Metric; oldNewRequests: Metric; staleRequests: Metric; overdueTasks: Metric; overdueDeliveries: Metric;
}) {
  const value = (metric: Metric) => metric.isLoading || metric.isError ? "—" : metric.data ?? "—";
  const tiles = [
    { title: "Новые заявки", metric: newRequests, url: EXEC_LINKS.newRequests, caption: `из них старше 2 дн.: ${value(oldNewRequests)}`, overdue: false },
    { title: "Без движения", metric: staleRequests, url: EXEC_LINKS.staleRequests, caption: "дольше 2 дней без изменений", overdue: false },
    { title: "Просроченные поставки", metric: overdueDeliveries, url: EXEC_LINKS.overdueDeliveries, caption: "плановая дата прошла", overdue: true },
    { title: "Просроченные задачи", metric: overdueTasks, url: EXEC_LINKS.overdueTasks, caption: `из ${value(activeTasks)} ${pluralRu(activeTasks.data ?? 0,["активной","активных","активных"])}`, overdue: true },
  ];
  return <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
    {tiles.map(({ title, metric, url, caption, overdue }) => <Button key={title} variant="ghost" asChild className="h-[104px] min-w-0 flex-col items-start justify-between gap-0 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-foreground sm:h-28 sm:p-4">
      <Link to={url}><span className="w-full whitespace-normal text-xs font-medium leading-4">{title}</span>
        {metric.isLoading ? <Skeleton className="h-8 w-16" /> : <span className={`text-[28px] font-semibold leading-8 tabular-nums ${overdue && !metric.isError && (metric.data ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}>{value(metric)}</span>}
        <span className="whitespace-normal text-xs font-normal leading-4 text-muted-foreground">{metric.isError ? "Не удалось загрузить" : caption}</span>
      </Link>
    </Button>)}
  </div>;
}
