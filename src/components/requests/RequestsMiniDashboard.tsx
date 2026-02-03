import { useMemo } from "react";
import { AlertTriangle, FileText, Truck, CheckCircle2, Calendar } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { SpecialDateFilter } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";
import { addDays, startOfToday, isBefore, isAfter } from "date-fns";

interface RequestsMiniDashboardProps {
  requests: Request[] | undefined;
  onFilterClick: (type: "priority" | "status", value: string) => void;
  onSpecialFilterClick: (filter: SpecialDateFilter) => void;
  activeSpecialFilter?: SpecialDateFilter;
}

interface MetricCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  activeColor: string;
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
    
    // Filter out delivered requests for active metrics
    const activeRequests = requests.filter(r => r.status !== "Доставлено");
    
    const emergency = activeRequests.filter(r => r.priority === "Аварийно").length;
    const newRequests = activeRequests.filter(r => r.status === "Новая заявка").length;
    const inTransit = activeRequests.filter(r => r.status === "В пути").length;
    
    // Delivered in last 7 days
    const deliveredThisWeek = requests.filter(r => {
      if (r.status !== "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, sevenDaysAgo) && isBefore(deliveryDate, addDays(today, 1));
    }).length;
    
    // Upcoming deliveries (next 7 days)
    const upcomingDeliveries = requests.filter(r => {
      if (r.status === "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, addDays(today, -1)) && isBefore(deliveryDate, addDays(sevenDaysFromNow, 1));
    }).length;
    
    return { emergency, new: newRequests, inTransit, deliveredThisWeek, upcomingDeliveries };
  }, [requests]);

  const cards: MetricCard[] = [
    {
      id: "emergency",
      label: "Аварийных",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50",
      activeColor: "bg-red-200 dark:bg-red-900 ring-2 ring-red-500",
      type: "priority",
      value: "Аварийно",
    },
    {
      id: "new",
      label: "Новых",
      icon: <FileText className="h-3.5 w-3.5" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50",
      activeColor: "bg-amber-200 dark:bg-amber-900 ring-2 ring-amber-500",
      type: "status",
      value: "Новая заявка",
    },
    {
      id: "inTransit",
      label: "В пути",
      icon: <Truck className="h-3.5 w-3.5" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50",
      activeColor: "bg-blue-200 dark:bg-blue-900 ring-2 ring-blue-500",
      type: "status",
      value: "В пути",
    },
    {
      id: "deliveredThisWeek",
      label: "Доставлено за неделю",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50",
      activeColor: "bg-green-200 dark:bg-green-900 ring-2 ring-green-500",
      type: "special",
      specialFilter: "deliveredLast7Days",
    },
    {
      id: "upcomingDeliveries",
      label: "Доставка скоро",
      icon: <Calendar className="h-3.5 w-3.5" />,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50",
      activeColor: "bg-purple-200 dark:bg-purple-900 ring-2 ring-purple-500",
      type: "special",
      specialFilter: "upcomingNext7Days",
    },
  ];

  const getMetricValue = (id: string): number => {
    switch (id) {
      case "emergency":
        return metrics.emergency;
      case "new":
        return metrics.new;
      case "inTransit":
        return metrics.inTransit;
      case "deliveredThisWeek":
        return metrics.deliveredThisWeek;
      case "upcomingDeliveries":
        return metrics.upcomingDeliveries;
      default:
        return 0;
    }
  };

  const isCardActive = (card: MetricCard): boolean => {
    if (card.type === "special" && card.specialFilter) {
      return activeSpecialFilter === card.specialFilter;
    }
    return false;
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {cards.map((card) => (
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
            "flex items-center gap-2 py-1.5 px-2.5 rounded-md border border-border/50 transition-all cursor-pointer active:scale-[0.98]",
            isCardActive(card) ? card.activeColor : card.bgColor
          )}
        >
          <div className={cn("p-1 rounded bg-background/80", card.color)}>
            {card.icon}
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span className={cn("text-base font-bold", card.color)}>
              {getMetricValue(card.id)}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {card.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
