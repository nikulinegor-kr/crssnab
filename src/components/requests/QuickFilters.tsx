import { Button } from "@/components/ui/button";
import { AlertTriangle, Zap, FileText, Truck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface QuickFiltersProps {
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
}

interface QuickFilterButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  type: "status" | "priority";
  value: string;
}

const QUICK_FILTERS: QuickFilterButton[] = [
  {
    id: "emergency",
    label: "Аварийные",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    activeColor: "bg-red-600 text-white border-red-600 hover:bg-red-700",
    type: "priority",
    value: "Аварийно",
  },
  {
    id: "priority",
    label: "Приоритетные",
    icon: <Zap className="h-3.5 w-3.5" />,
    activeColor: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600",
    type: "priority",
    value: "Приоритетно",
  },
  {
    id: "invoice-accounting",
    label: "Счёт в Бухгалтерии",
    icon: <FileText className="h-3.5 w-3.5" />,
    activeColor: "bg-purple-500 text-white border-purple-500 hover:bg-purple-600",
    type: "status",
    value: "Счёт в Бухгалтерии",
  },
  {
    id: "in-transit",
    label: "В пути",
    icon: <Truck className="h-3.5 w-3.5" />,
    activeColor: "bg-blue-500 text-white border-blue-500 hover:bg-blue-600",
    type: "status",
    value: "В пути",
  },
  {
    id: "delivered",
    label: "Доставлено",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    activeColor: "bg-green-600 text-white border-green-600 hover:bg-green-700",
    type: "status",
    value: "Доставлено",
  },
];

export const QuickFilters = ({
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
}: QuickFiltersProps) => {
  const isFilterActive = (filter: QuickFilterButton): boolean => {
    if (filter.type === "priority") {
      return priorityFilter === filter.value;
    }
    return statusFilter.includes(filter.value);
  };

  const toggleFilter = (filter: QuickFilterButton) => {
    if (filter.type === "priority") {
      if (priorityFilter === filter.value) {
        setPriorityFilter("all");
      } else {
        setPriorityFilter(filter.value);
      }
    } else {
      if (statusFilter.includes(filter.value)) {
        setStatusFilter(statusFilter.filter(s => s !== filter.value));
      } else {
        setStatusFilter([...statusFilter, filter.value]);
      }
    }
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 sm:gap-2 pb-1">
        {QUICK_FILTERS.map((filter) => {
          const isActive = isFilterActive(filter);
          return (
            <Button
              key={filter.id}
              variant="outline"
              size="sm"
              onClick={() => toggleFilter(filter)}
              className={cn(
                "h-7 sm:h-8 text-xs gap-1.5 px-2.5 sm:px-3 transition-all shrink-0 whitespace-nowrap font-medium shadow-none",
                isActive
                  ? filter.activeColor
                  : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
              )}
            >
              {filter.icon}
              <span>{filter.label}</span>
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" className="h-1" />
    </ScrollArea>
  );
};
