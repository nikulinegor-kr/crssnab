import { useMemo } from "react";
import { AlertTriangle, FileText, Truck, CheckCircle2, Calendar } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { SpecialDateFilter } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { addDays, startOfToday, isBefore, isAfter, subDays } from "date-fns";

interface RequestsMiniDashboardProps {
  requests: Request[] | undefined;
  previousRequests?: Request[] | undefined;
  onFilterClick: (type: "priority" | "status", value: string) => void;
  onSpecialFilterClick: (filter: SpecialDateFilter) => void;
  activeSpecialFilter?: SpecialDateFilter;
}

interface MetricCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  iconBg: string;
  activeColor: string;
  bgColor: string;
  type: "priority" | "status" | "special";
  value?: string;
  specialFilter?: SpecialDateFilter;
}

export const RequestsMiniDashboard = ({ 
  requests, 
  onFilterClick,
  onSpecialFilterClick,
  activeSpecialFilter,
}: RequestsMiniDashboardProps) => {
  const metrics = useMemo(() => {
    if (!requests) return { emergency: 0, new: 0, inTransit: 0, deliveredThisWeek: 0, upcomingDeliveries: 0 };
    
    const today = startOfToday();
    const sevenDaysAgo = addDays(today, -7);
    const sevenDaysFromNow = addDays(today, 7);
    
    const activeRequests = requests.filter(r => r.status !== "Доставлено");
    
    const emergency = activeRequests.filter(r => r.priority === "Аварийно").length;
    const newRequests = activeRequests.filter(r => r.status === "Новая заявка").length;
    const inTransit = activeRequests.filter(r => r.status === "В пути").length;
    
    const deliveredThisWeek = requests.filter(r => {
      if (r.status !== "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, sevenDaysAgo) && isBefore(deliveryDate, addDays(today, 1));
    }).length;
    
    const upcomingDeliveries = requests.filter(r => {
      if (r.status === "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, addDays(today, -1)) && isBefore(deliveryDate, addDays(sevenDaysFromNow, 1));
    }).length;
    
    return { emergency, new: newRequests, inTransit, deliveredThisWeek, upcomingDeliveries };
  }, [requests]);

  // Simulate dynamics based on recent data (last 7 days vs previous 7 days)
  const dynamics = useMemo(() => {
    if (!requests) return { emergency: 0, new: 0, inTransit: 0, deliveredThisWeek: 0, upcomingDeliveries: 0 };
    
    const today = startOfToday();
    const sevenDaysAgo = subDays(today, 7);
    const fourteenDaysAgo = subDays(today, 14);
    
    const recentRequests = requests.filter(r => {
      const d = new Date(r.created_at || r.request_date);
      return isAfter(d, sevenDaysAgo);
    });
    const olderRequests = requests.filter(r => {
      const d = new Date(r.created_at || r.request_date);
      return isAfter(d, fourteenDaysAgo) && isBefore(d, sevenDaysAgo);
    });
    
    const recentEmergency = recentRequests.filter(r => r.priority === "Аварийно").length;
    const olderEmergency = olderRequests.filter(r => r.priority === "Аварийно").length;
    
    const recentNew = recentRequests.filter(r => r.status === "Новая заявка").length;
    const olderNew = olderRequests.filter(r => r.status === "Новая заявка").length;
    
    const recentInTransit = recentRequests.filter(r => r.status === "В пути").length;
    const olderInTransit = olderRequests.filter(r => r.status === "В пути").length;
    
    return {
      emergency: recentEmergency - olderEmergency,
      new: recentNew - olderNew,
      inTransit: recentInTransit - olderInTransit,
      deliveredThisWeek: 0,
      upcomingDeliveries: 0,
    };
  }, [requests]);

  const cards: MetricCard[] = [
    {
      id: "emergency",
      label: "Аварийных",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      color: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-100 dark:bg-red-900/50",
      bgColor: "bg-card border-border/40 shadow-sm hover:shadow-md hover:border-red-300 dark:hover:border-red-700",
      activeColor: "bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-800",
      type: "priority",
      value: "Аварийно",
    },
    {
      id: "new",
      label: "Новых",
      icon: <FileText className="h-3.5 w-3.5" />,
      color: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      bgColor: "bg-card border-border/40 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700",
      activeColor: "bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-800",
      type: "status",
      value: "Новая заявка",
    },
    {
      id: "inTransit",
      label: "В пути",
      icon: <Truck className="h-3.5 w-3.5" />,
      color: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      bgColor: "bg-background border-border/60 hover:border-blue-300 dark:hover:border-blue-700",
      activeColor: "bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800",
      type: "status",
      value: "В пути",
    },
    {
      id: "deliveredThisWeek",
      label: "Доставлено за неделю",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "text-green-600 dark:text-green-400",
      iconBg: "bg-green-100 dark:bg-green-900/50",
      bgColor: "bg-background border-border/60 hover:border-green-300 dark:hover:border-green-700",
      activeColor: "bg-green-50 dark:bg-green-950/60 border-green-400 dark:border-green-600 ring-1 ring-green-200 dark:ring-green-800",
      type: "special",
      specialFilter: "deliveredLast7Days",
    },
    {
      id: "upcomingDeliveries",
      label: "Доставка скоро",
      icon: <Calendar className="h-3.5 w-3.5" />,
      color: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-100 dark:bg-purple-900/50",
      bgColor: "bg-background border-border/60 hover:border-purple-300 dark:hover:border-purple-700",
      activeColor: "bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 ring-1 ring-purple-200 dark:ring-purple-800",
      type: "special",
      specialFilter: "upcomingNext7Days",
    },
  ];

  const getMetricValue = (id: string): number => {
    switch (id) {
      case "emergency": return metrics.emergency;
      case "new": return metrics.new;
      case "inTransit": return metrics.inTransit;
      case "deliveredThisWeek": return metrics.deliveredThisWeek;
      case "upcomingDeliveries": return metrics.upcomingDeliveries;
      default: return 0;
    }
  };

  const getDynamicValue = (id: string): number => {
    switch (id) {
      case "emergency": return dynamics.emergency;
      case "new": return dynamics.new;
      case "inTransit": return dynamics.inTransit;
      case "deliveredThisWeek": return dynamics.deliveredThisWeek;
      case "upcomingDeliveries": return dynamics.upcomingDeliveries;
      default: return 0;
    }
  };

  const isCardActive = (card: MetricCard): boolean => {
    if (card.type === "special" && card.specialFilter) {
      return activeSpecialFilter === card.specialFilter;
    }
    return false;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
      {cards.map((card) => {
        const dynamicVal = getDynamicValue(card.id);
        return (
          <div
            key={card.id}
            onClick={() => {
              if (card.type === "special" && card.specialFilter) {
                onSpecialFilterClick(activeSpecialFilter === card.specialFilter ? null : card.specialFilter);
              } else if (card.value) {
                onFilterClick(card.type as "priority" | "status", card.value);
              }
            }}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border shadow-sm transition-all cursor-pointer active:scale-[0.97]",
              "hover:shadow-md hover:-translate-y-0.5",
              isCardActive(card) ? card.activeColor : card.bgColor
            )}
          >
            <div className={cn("p-1.5 rounded-md shrink-0", card.iconBg, card.color)}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-xl font-semibold leading-none tracking-tight", card.color)}>
                  {getMetricValue(card.id)}
                </span>
                {dynamicVal !== 0 && (
                  <span className={cn(
                    "text-[10px] font-medium leading-none",
                    dynamicVal > 0 ? "text-red-500" : "text-green-500"
                  )}>
                    {dynamicVal > 0 ? `+${dynamicVal}` : dynamicVal}
                  </span>
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5 leading-tight truncate">
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
