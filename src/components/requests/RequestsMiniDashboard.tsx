import { useMemo } from "react";
import { AlertTriangle, FileText, Truck, Clock } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";

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
    if (!requests) return { emergency: 0, new: 0, inTransit: 0, avgClosingTime: 0 };
    
    const emergency = requests.filter(r => r.priority === "Аварийно").length;
    const newRequests = requests.filter(r => r.status === "Новая заявка").length;
    const inTransit = requests.filter(r => r.status === "В пути").length;
    
    // Calculate average closing time for delivered requests
    const deliveredRequests = requests.filter(r => 
      r.status === "Доставлено" && r.delivery_date && r.request_date
    );
    
    let avgClosingTime = 0;
    if (deliveredRequests.length > 0) {
      const totalDays = deliveredRequests.reduce((sum, r) => {
        const start = new Date(r.request_date);
        const end = new Date(r.delivery_date!);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, days);
      }, 0);
      avgClosingTime = Math.round((totalDays / deliveredRequests.length) * 10) / 10;
    }
    
    return { emergency, new: newRequests, inTransit, avgClosingTime };
  }, [requests]);

  const cards: MetricCard[] = [
    {
      id: "emergency",
      label: "Аварийных",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50",
      type: "priority",
      value: "Аварийно",
    },
    {
      id: "new",
      label: "Новых",
      icon: <FileText className="h-4 w-4" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50",
      type: "status",
      value: "Новая заявка",
    },
    {
      id: "inTransit",
      label: "В пути",
      icon: <Truck className="h-4 w-4" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50",
      type: "status",
      value: "В пути",
    },
    {
      id: "avgTime",
      label: "Ср. время",
      icon: <Clock className="h-4 w-4" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
      type: "metric",
    },
  ];

  const getMetricValue = (id: string): number | string => {
    switch (id) {
      case "emergency":
        return metrics.emergency;
      case "new":
        return metrics.new;
      case "inTransit":
        return metrics.inTransit;
      case "avgTime":
        return `${metrics.avgClosingTime} дн.`;
      default:
        return 0;
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {cards.map((card) => {
        const isClickable = card.type !== "metric";
        return (
          <div
            key={card.id}
            onClick={() => {
              if (isClickable && card.value) {
                onFilterClick(card.type as "priority" | "status", card.value);
              }
            }}
            className={cn(
              "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-border/50 transition-all",
              card.bgColor,
              isClickable && "cursor-pointer active:scale-[0.98]"
            )}
          >
            <div className={cn("p-1.5 rounded-md bg-background/80", card.color)}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("text-lg sm:text-xl font-bold", card.color)}>
                {getMetricValue(card.id)}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
