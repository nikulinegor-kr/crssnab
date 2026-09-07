import { useMemo } from "react";
import {
  AlertTriangle, Flame, CalendarClock, Clock, Truck, Package,
  CalendarCheck, CalendarX, CreditCard, CircleDollarSign, Receipt,
  FileText, Wrench, CheckCircle2
} from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { SpecialDateFilter } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { startOfToday, isBefore, differenceInDays, isToday } from "date-fns";

interface RequestsMiniDashboardProps {
  requests: Request[] | undefined;
  onFilterClick: (type: "priority" | "status", value: string) => void;
  onSpecialFilterClick: (filter: SpecialDateFilter) => void;
  activeSpecialFilter?: SpecialDateFilter;
  activePriorityFilter?: string;
  activeStatusFilter?: string[];
}

interface MetricItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  iconBg: string;
  activeBg: string;
  type: "priority" | "status" | "special";
  value?: string;
  specialFilter?: SpecialDateFilter;
}

interface MetricGroup {
  title: string;
  items: MetricItem[];
}

export const RequestsMiniDashboard = ({
  requests,
  onFilterClick,
  onSpecialFilterClick,
  activeSpecialFilter,
  activePriorityFilter,
  activeStatusFilter,
}: RequestsMiniDashboardProps) => {
  const metrics = useMemo(() => {
    if (!requests) return null;
    const today = startOfToday();
    const active = requests.filter(r => r.status !== "Доставлено" && r.status !== "Выполнено");

    const emergency = active.filter(r => r.priority === "Аварийно").length;
    const priority = active.filter(r => r.priority === "Приоритетно").length;
    const planned = active.filter(r => r.priority === "Планово").length;

    const overdue = active.filter(r => {
      if (!r.delivery_date) return false;
      return isBefore(new Date(r.delivery_date), today);
    }).length;
    const stale = active.filter(r => {
      const lastUpdate = new Date(r.updated_at || r.created_at);
      return differenceInDays(today, lastUpdate) > 2;
    }).length;

    const inTransit = active.filter(r => r.status === "В пути" || r.status === "Доставлено в ТК").length;
    const deliveredToTk = active.filter(r => r.status === "Доставлено в ТК").length;
    const deliveryToday = active.filter(r => {
      if (!r.delivery_date) return false;
      return isToday(new Date(r.delivery_date));
    }).length;
    const overdueShipment = active.filter(r => {
      const shipDate = (r as any).shipment_date;
      if (!shipDate) return false;
      if (["В пути", "Доставлено", "Доставлено в ТК"].includes(r.status)) return false;
      return isBefore(new Date(shipDate), today);
    }).length;

    const unpaid = active.filter(r => {
      const pct = (r as any).payment_percent ?? r.payment_percentage ?? 0;
      return pct === 0 && r.amount > 0;
    }).length;
    const paid = active.filter(r => {
      const pct = (r as any).payment_percent ?? r.payment_percentage ?? 0;
      return pct >= 100;
    }).length;
    const invoiced = active.filter(r =>
      r.status === "Счёт в Бухгалтерии"
    ).length;

    const newRequests = active.filter(r => r.status === "Новая заявка").length;
    const inWork = active.filter(r => r.status === "В работе" || r.status === "КП" || r.status === "На согласовании").length;
    const delivered = requests.filter(r => r.status === "Доставлено").length;

    return {
      emergency, priority, planned,
      overdue, stale,
      inTransit, deliveredToTk, deliveryToday, overdueShipment,
      unpaid, paid, invoiced,
      newRequests, inWork, delivered,
    };
  }, [requests]);

  if (!metrics) return null;

  const groups: MetricGroup[] = [
    {
      title: "Срочность",
      items: [
        {
          id: "emergency", label: "Аварийные", count: metrics.emergency,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          colorClass: "text-destructive dark:text-destructive",
          iconBg: "bg-destructive/10 dark:bg-destructive/50",
          activeBg: "bg-destructive/10 dark:bg-destructive/60 border-destructive/30 dark:border-destructive/30 ring-1 ring-destructive/30 dark:ring-destructive/30",
          type: "priority", value: "Аварийно",
        },
        {
          id: "priority", label: "Приоритетные", count: metrics.priority,
          icon: <Flame className="h-3.5 w-3.5" />,
          colorClass: "text-warning dark:text-warning",
          iconBg: "bg-warning/10 dark:bg-warning/50",
          activeBg: "bg-warning/10 dark:bg-warning/60 border-warning/30 dark:border-warning/30 ring-1 ring-warning/30 dark:ring-warning/30",
          type: "priority", value: "Приоритетно",
        },
        {
          id: "planned", label: "Плановые", count: metrics.planned,
          icon: <CalendarClock className="h-3.5 w-3.5" />,
          colorClass: "text-info dark:text-info",
          iconBg: "bg-info/10 dark:bg-info/50",
          activeBg: "bg-info/10 dark:bg-info/60 border-info/30 dark:border-info/30 ring-1 ring-info/30 dark:ring-info/30",
          type: "priority", value: "Планово",
        },
      ],
    },
    {
      title: "Проблемы",
      items: [
        {
          id: "overdue", label: "Просроченные", count: metrics.overdue,
          icon: <CalendarX className="h-3.5 w-3.5" />,
          colorClass: "text-destructive dark:text-destructive",
          iconBg: "bg-destructive/10 dark:bg-destructive/50",
          activeBg: "bg-destructive/10 dark:bg-destructive/60 border-destructive/30 dark:border-destructive/30 ring-1 ring-destructive/30 dark:ring-destructive/30",
          type: "special", specialFilter: "overdue",
        },
        {
          id: "stale", label: "Зависшие", count: metrics.stale,
          icon: <Clock className="h-3.5 w-3.5" />,
          colorClass: "text-warning dark:text-warning",
          iconBg: "bg-warning/10 dark:bg-warning/50",
          activeBg: "bg-warning/10 dark:bg-warning/60 border-warning/30 dark:border-warning/30 ring-1 ring-warning/30 dark:ring-warning/30",
          type: "special", specialFilter: "stale",
        },
        {
          id: "overdueShipment", label: "Просрочка отгрузки", count: metrics.overdueShipment,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          colorClass: "text-destructive dark:text-destructive",
          iconBg: "bg-destructive/10 dark:bg-destructive/50",
          activeBg: "bg-destructive/10 dark:bg-destructive/60 border-destructive/30 dark:border-destructive/30 ring-1 ring-destructive/30 dark:ring-destructive/30",
          type: "special", specialFilter: "overdueShipment",
        },
      ],
    },
    {
      title: "Логистика",
      items: [
        {
          id: "inTransit", label: "В пути", count: metrics.inTransit,
          icon: <Truck className="h-3.5 w-3.5" />,
          colorClass: "text-info dark:text-info",
          iconBg: "bg-info/10 dark:bg-info/50",
          activeBg: "bg-info/10 dark:bg-info/60 border-info/30 dark:border-info/30 ring-1 ring-info/30 dark:ring-info/30",
          type: "status", value: "В пути",
        },
        {
          id: "deliveredToTk", label: "Доставлено в ТК", count: metrics.deliveredToTk,
          icon: <Package className="h-3.5 w-3.5" />,
          colorClass: "text-info dark:text-info",
          iconBg: "bg-info/10 dark:bg-info/50",
          activeBg: "bg-info/10 dark:bg-info/60 border-info/30 dark:border-info/30 ring-1 ring-info/30 dark:ring-info/30",
          type: "status", value: "Доставлено в ТК",
        },
        {
          id: "deliveryToday", label: "Доставка сегодня", count: metrics.deliveryToday,
          icon: <CalendarCheck className="h-3.5 w-3.5" />,
          colorClass: "text-success dark:text-success",
          iconBg: "bg-success/10 dark:bg-success/50",
          activeBg: "bg-success/10 dark:bg-success/60 border-success/30 dark:border-success/30 ring-1 ring-success/30 dark:ring-success/30",
          type: "special", specialFilter: "deliveryToday",
        },
      ],
    },
    {
      title: "Финансы",
      items: [
        {
          id: "unpaid", label: "Не оплачено", count: metrics.unpaid,
          icon: <CreditCard className="h-3.5 w-3.5" />,
          colorClass: "text-slate-600 dark:text-slate-400",
          iconBg: "bg-slate-100 dark:bg-slate-800/50",
          activeBg: "bg-slate-50 dark:bg-slate-950/60 border-slate-400 dark:border-slate-600 ring-1 ring-slate-200 dark:ring-slate-800",
          type: "special", specialFilter: "unpaid",
        },
        {
          id: "paid", label: "Оплачено", count: metrics.paid,
          icon: <CircleDollarSign className="h-3.5 w-3.5" />,
          colorClass: "text-success dark:text-success",
          iconBg: "bg-success/10 dark:bg-success/50",
          activeBg: "bg-success/10 dark:bg-success/60 border-success/30 dark:border-success/30 ring-1 ring-success/30 dark:ring-success/30",
          type: "special", specialFilter: "paid",
        },
        {
          id: "invoiced", label: "Счета выставлены", count: metrics.invoiced,
          icon: <Receipt className="h-3.5 w-3.5" />,
          colorClass: "text-violet-600 dark:text-violet-400",
          iconBg: "bg-violet-100 dark:bg-violet-900/50",
          activeBg: "bg-violet-50 dark:bg-violet-950/60 border-violet-400 dark:border-violet-600 ring-1 ring-violet-200 dark:ring-violet-800",
          type: "status", value: "Счёт в Бухгалтерии",
        },
      ],
    },
    {
      title: "Работа",
      items: [
        {
          id: "newRequests", label: "Новые заявки", count: metrics.newRequests,
          icon: <FileText className="h-3.5 w-3.5" />,
          colorClass: "text-slate-600 dark:text-slate-400",
          iconBg: "bg-slate-100 dark:bg-slate-800/50",
          activeBg: "bg-slate-50 dark:bg-slate-950/60 border-slate-400 dark:border-slate-600 ring-1 ring-slate-200 dark:ring-slate-800",
          type: "status", value: "Новая заявка",
        },
        {
          id: "inWork", label: "В работе", count: metrics.inWork,
          icon: <Wrench className="h-3.5 w-3.5" />,
          colorClass: "text-warning dark:text-warning",
          iconBg: "bg-warning/10 dark:bg-warning/50",
          activeBg: "bg-warning/10 dark:bg-warning/60 border-warning/30 dark:border-warning/30 ring-1 ring-warning/30 dark:ring-warning/30",
          type: "status", value: "В работе",
        },
        {
          id: "delivered", label: "Доставлено", count: metrics.delivered,
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          colorClass: "text-success dark:text-success",
          iconBg: "bg-success/10 dark:bg-success/50",
          activeBg: "bg-success/10 dark:bg-success/60 border-success/30 dark:border-success/30 ring-1 ring-success/30 dark:ring-success/30",
          type: "status", value: "Доставлено",
        },
      ],
    },
  ];

  const isItemActive = (item: MetricItem): boolean => {
    if (item.type === "special" && item.specialFilter) {
      return activeSpecialFilter === item.specialFilter;
    }
    if (item.type === "priority" && item.value) {
      return activePriorityFilter === item.value;
    }
    if (item.type === "status" && item.value) {
      return activeStatusFilter?.length === 1 && activeStatusFilter[0] === item.value;
    }
    return false;
  };

  const handleClick = (item: MetricItem) => {
    if (item.type === "special" && item.specialFilter) {
      onSpecialFilterClick(activeSpecialFilter === item.specialFilter ? null : item.specialFilter);
    } else if (item.value) {
      onFilterClick(item.type as "priority" | "status", item.value);
    }
  };

  return (
    <div className="flex gap-2 overflow-x-auto border border-border bg-card px-2 py-2">
      {groups.map((group) => (
        <div key={group.title} className="flex min-w-max items-center gap-1 border-r border-border pr-2 last:border-r-0">
          <h3 className="px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {group.title}
          </h3>
          <div className="flex gap-1">
            {group.items.map((item) => {
              const active = isItemActive(item);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-sm border px-2 text-left transition-colors",
                    "hover:bg-accent",
                    active
                      ? item.activeBg
                      : "bg-card border-border",
                    item.count > 0 && (item.id === "emergency" || item.id === "overdue" || item.id === "overdueShipment")
                      ? "border-destructive/60 dark:border-destructive/40"
                      : ""
                  )}
                >
                  <span className={cn("shrink-0", item.colorClass)}>
                    {item.icon}
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{item.label}</span>
                  <span className={cn(
                    "font-numeric text-xs font-semibold tabular-nums",
                    item.count > 0 ? item.colorClass : "text-muted-foreground/40"
                  )}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
