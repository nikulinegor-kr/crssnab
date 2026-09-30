import { useMemo } from "react";
import { Request } from "@/hooks/useRequests";
import { SpecialDateFilter } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { isOverdue, isStale, isUnpaid } from "@/lib/requestAttention";

interface RequestsMiniDashboardProps {
  requests: Request[] | undefined;
  onFilterClick: (type: "priority" | "status", value: string) => void;
  onSpecialFilterClick: (filter: SpecialDateFilter) => void;
  activeSpecialFilter?: SpecialDateFilter;
  activePriorityFilter?: string;
  activeStatusFilter?: string[];
}

export const RequestsMiniDashboard = ({
  requests,
  onSpecialFilterClick,
  activeSpecialFilter,
}: RequestsMiniDashboardProps) => {
  const metrics = useMemo(() => {
    const all = requests || [];

    return {
      overdue: all.filter((r) => isOverdue(r)).length,
      stale: all.filter((r) => isStale(r)).length,
      unpaid: all.filter((r) => isUnpaid(r)).length,
    };
  }, [requests]);

  const items: Array<{ label: string; count: number; filter: Exclude<SpecialDateFilter, null> }> = [
    { label: "Просрочено", count: metrics.overdue, filter: "overdue" },
    { label: "Зависло дольше 2 дней", count: metrics.stale, filter: "stale" },
    { label: "Ждёт оплаты", count: metrics.unpaid, filter: "unpaid" },
  ];

  return (
    <div className="flex min-h-9 items-center gap-2 overflow-x-auto border-b border-border bg-card px-2 py-1.5">
      <span className="shrink-0 text-xs font-semibold text-foreground">Требует внимания</span>
      <span className="h-4 w-px shrink-0 bg-border" />
      {items.map((item) => {
        const active = activeSpecialFilter === item.filter;
        return (
          <button
            key={item.filter}
            type="button"
            onClick={() => onSpecialFilterClick(active ? null : item.filter)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
              active
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            <span className={cn("font-numeric font-semibold", item.filter === "overdue" && item.count > 0 && "text-destructive")}>{item.count}</span>
          </button>
        );
      })}
    </div>
  );
};