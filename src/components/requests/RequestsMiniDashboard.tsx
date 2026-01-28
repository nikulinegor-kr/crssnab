import { useMemo } from "react";
import { AlertTriangle, FileText, Truck } from "lucide-react";
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
    if (!requests) return { emergency: 0, new: 0, inTransit: 0 };
    
    // Filter out delivered requests for active metrics
    const activeRequests = requests.filter(r => r.status !== "Доставлено");
    
    const emergency = activeRequests.filter(r => r.priority === "Аварийно").length;
    const newRequests = activeRequests.filter(r => r.status === "Новая заявка").length;
    const inTransit = activeRequests.filter(r => r.status === "В пути").length;
    
    return { emergency, new: newRequests, inTransit };
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
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50",
      type: "status",
      value: "В пути",
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
      default:
        return 0;
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => {
            if (card.value) {
              onFilterClick(card.type as "priority" | "status", card.value);
            }
          }}
          className={cn(
            "flex items-center gap-2 py-1.5 px-2.5 rounded-md border border-border/50 transition-all",
            card.bgColor,
            "cursor-pointer active:scale-[0.98]"
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
