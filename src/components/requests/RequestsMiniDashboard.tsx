import { useMemo } from "react";
import {
  AlertTriangle, Flame, CalendarClock, Clock, Truck, Package,
  CalendarCheck, CalendarX, CreditCard, CircleDollarSign, Receipt,
  FileText, Wrench
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

    return {
      emergency, priority, planned,
      overdue, stale,
      inTransit, deliveryToday, overdueShipment,
      unpaid, paid, invoiced,
      newRequests, inWork,
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
          colorClass: "text-red-600 dark:text-red-400",
          iconBg: "bg-red-100 dark:bg-red-900/50",
          activeBg: "bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-800",
          type: "priority", value: "Аварийно",
        },
        {
          id: "priority", label: "Приоритетные", count: metrics.priority,
          icon: <Flame className="h-3.5 w-3.5" />,
          colorClass: "text-orange-600 dark:text-orange-400",
          iconBg: "bg-orange-100 dark:bg-orange-900/50",
          activeBg: "bg-orange-50 dark:bg-orange-950/60 border-orange-400 dark:border-orange-600 ring-1 ring-orange-200 dark:ring-orange-800",
          type: "priority", value: "Приоритетно",
        },
        {
          id: "planned", label: "Плановые", count: metrics.planned,
          icon: <CalendarClock className="h-3.5 w-3.5" />,
          colorClass: "text-blue-600 dark:text-blue-400",
          iconBg: "bg-blue-100 dark:bg-blue-900/50",
          activeBg: "bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800",
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
          colorClass: "text-red-600 dark:text-red-400",
          iconBg: "bg-red-100 dark:bg-red-900/50",
          activeBg: "bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-800",
          type: "special", specialFilter: "overdue",
        },
        {
          id: "stale", label: "Зависшие", count: metrics.stale,
          icon: <Clock className="h-3.5 w-3.5" />,
          colorClass: "text-amber-600 dark:text-amber-400",
          iconBg: "bg-amber-100 dark:bg-amber-900/50",
          activeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-800",
          type: "special", specialFilter: "stale",
        },
      ],
    },
    {
      title: "Логистика",
      items: [
        {
          id: "inTransit", label: "В пути", count: metrics.inTransit,
          icon: <Truck className="h-3.5 w-3.5" />,
          colorClass: "text-blue-600 dark:text-blue-400",
          iconBg: "bg-blue-100 dark:bg-blue-900/50",
          activeBg: "bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800",
          type: "status", value: "В пути",
        },
        {
          id: "deliveryToday", label: "Доставка сегодня", count: metrics.deliveryToday,
          icon: <CalendarCheck className="h-3.5 w-3.5" />,
          colorClass: "text-emerald-600 dark:text-emerald-400",
          iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
          activeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-800",
          type: "special", specialFilter: "deliveryToday",
        },
        {
          id: "overdueShipment", label: "Просрочка отгрузки", count: metrics.overdueShipment,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          colorClass: "text-red-600 dark:text-red-400",
          iconBg: "bg-red-100 dark:bg-red-900/50",
          activeBg: "bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-800",
          type: "special", specialFilter: "overdueShipment",
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
          colorClass: "text-emerald-600 dark:text-emerald-400",
          iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
          activeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-800",
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
          colorClass: "text-amber-600 dark:text-amber-400",
          iconBg: "bg-amber-100 dark:bg-amber-900/50",
          activeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-800",
          type: "status", value: "В работе",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {groups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            {group.title}
          </h3>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isItemActive(item);
              return (
                <div
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all cursor-pointer active:scale-[0.97]",
                    "hover:shadow-sm hover:-translate-y-px",
                    active
                      ? item.activeBg
                      : "bg-card border-border/40 hover:border-border",
                    item.count > 0 && (item.id === "emergency" || item.id === "overdue" || item.id === "overdueDelivery")
                      ? "border-red-200/60 dark:border-red-800/40"
                      : ""
                  )}
                >
                  <div className={cn("p-1 rounded-md shrink-0", item.iconBg, item.colorClass)}>
                    {item.icon}
                  </div>
                  <span className="text-xs text-muted-foreground truncate flex-1">{item.label}</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    item.count > 0 ? item.colorClass : "text-muted-foreground/40"
                  )}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
