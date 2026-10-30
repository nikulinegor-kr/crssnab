import { Link } from "react-router-dom";
import { ListChecks, Inbox, ShoppingCart, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Metric = { data?: number; isLoading: boolean; isError: boolean };
export function ExecKpiTiles({ activeTasks, newRequests, openRequests, overdueTasks, overdueDeliveries }: {
  activeTasks: Metric; newRequests: Metric; openRequests: Metric; overdueTasks: Metric; overdueDeliveries: Metric;
}) {
  const overdue = { data: (overdueTasks.data ?? 0) + (overdueDeliveries.data ?? 0), isLoading: overdueTasks.isLoading || overdueDeliveries.isLoading, isError: overdueTasks.isError || overdueDeliveries.isError };
  const tiles = [
    { title: "Активные задачи", icon: ListChecks, metric: activeTasks, url: "/planner/tasks", caption: "задач в планировщике" },
    { title: "Новые заявки", icon: Inbox, metric: newRequests, url: "/requests", caption: "ждут обработки" },
    { title: "Заявки в работе", icon: ShoppingCart, metric: openRequests, url: "/requests", caption: "открытых заявок" },
    { title: "Просрочено", icon: AlertTriangle, metric: overdue, url: null, caption: overdue.isError ? "Не удалось загрузить" : `${overdueTasks.data ?? "—"} задач · ${overdueDeliveries.data ?? "—"} поставок` },
  ];
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {tiles.map(({ title, icon: Icon, metric, url, caption }) => {
      const content = <><span className="flex w-full items-center justify-between gap-2 text-xs font-medium sm:text-sm"><span className="whitespace-normal">{title}</span><Icon className="text-muted-foreground" /></span>
        {metric.isLoading ? <Skeleton className="h-9 w-20" /> : <span className={`text-3xl font-semibold tabular-nums ${url ? "text-foreground" : "text-destructive"}`}>{metric.isError ? "—" : metric.data?.toLocaleString("ru-RU") ?? "—"}</span>}
        <span className="whitespace-normal text-xs font-normal text-muted-foreground tabular-nums">{metric.isError ? "Не удалось загрузить" : caption}</span></>;
      const className = "h-36 min-w-0 flex-col items-start justify-between border border-border bg-card p-4 text-left text-foreground";
      return url ? <Button key={title} variant="ghost" asChild className={className}><Link to={url}>{content}</Link></Button> :
        <Button key={title} variant="ghost" className={className} onClick={() => document.getElementById("executive-attention")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}>{content}</Button>;
    })}
  </div>;
}