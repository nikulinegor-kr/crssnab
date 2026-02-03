import { useMemo } from "react";
import { AlertTriangle, FileText, Truck, CheckCircle2, Calendar } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, isWithinInterval, addDays, startOfToday, isBefore, isAfter } from "date-fns";

interface RequestsMiniDashboardProps {
  requests: Request[] | undefined;
  onFilterClick: (type: "priority" | "status", value: string) => void;
}

interface MetricCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  type: "priority" | "status" | "metric";
  value?: string;
}

export const RequestsMiniDashboard = ({ 
  requests, 
  onFilterClick 
}: RequestsMiniDashboardProps) => {
  const metrics = useMemo(() => {
    if (!requests) return { emergency: 0, new: 0, inTransit: 0, deliveredThisWeek: 0, upcomingDeliveries: 0 };
    
    const today = startOfToday();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const threeDaysFromNow = addDays(today, 3);
    
    // Filter out delivered requests for active metrics
    const activeRequests = requests.filter(r => r.status !== "Доставлено");
    
    const emergency = activeRequests.filter(r => r.priority === "Аварийно").length;
    const newRequests = activeRequests.filter(r => r.status === "Новая заявка").length;
    const inTransit = activeRequests.filter(r => r.status === "В пути").length;
    
    // Delivered this week
    const deliveredThisWeek = requests.filter(r => {
      if (r.status !== "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isWithinInterval(deliveryDate, { start: weekStart, end: weekEnd });
    }).length;
    
    // Upcoming deliveries (next 3 days)
    const upcomingDeliveries = requests.filter(r => {
      if (r.status === "Доставлено" || !r.delivery_date) return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, addDays(today, -1)) && isBefore(deliveryDate, addDays(threeDaysFromNow, 1));
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
      type: "priority",
      value: "Аварийно",
    },
    {
      id: "new",
      label: "Новых",
      icon: <FileText className="h-3.5 w-3.5" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50",
      type: "status",
      value: "Новая заявка",
    },
    {
      id: "inTransit",
      label: "В пути",
      icon: <Truck className="h-3.5 w-3.5" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50",
      type: "status",
      value: "В пути",
    },
    {
      id: "deliveredThisWeek",
      label: "Доставлено за неделю",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50",
      type: "status",
      value: "Доставлено",
    },
    {
      id: "upcomingDeliveries",
      label: "Доставка скоро",
      icon: <Calendar className="h-3.5 w-3.5" />,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50",
      type: "metric",
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

  return (
    <div className="grid grid-cols-5 gap-2">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => {
            if (card.value && card.type !== "metric") {
              onFilterClick(card.type as "priority" | "status", card.value);
            }
          }}
          className={cn(
            "flex items-center gap-2 py-1.5 px-2.5 rounded-md border border-border/50 transition-all",
            card.bgColor,
            card.type !== "metric" ? "cursor-pointer active:scale-[0.98]" : "cursor-default"
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
