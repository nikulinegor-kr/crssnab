import { Button } from "@/components/ui/button";
import { AlertTriangle, Zap, CreditCard, Truck, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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
  color: string;
  activeColor: string;
  type: "status" | "priority";
  value: string;
}

const QUICK_FILTERS: QuickFilterButton[] = [
  {
    id: "emergency",
    label: "Аварийные",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950",
    activeColor: "bg-red-600 text-white border-red-600 hover:bg-red-700",
    type: "priority",
    value: "Аварийно",
  },
  {
    id: "priority",
    label: "Приоритетные",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950",
    activeColor: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600",
    type: "priority",
    value: "Приоритетно",
  },
  {
    id: "awaiting-payment",
    label: "Ждут оплаты",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    color: "text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950",
    activeColor: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    type: "status",
    value: "Счёт",
  },
  {
    id: "in-transit",
    label: "В пути",
    icon: <Truck className="h-3.5 w-3.5" />,
    color: "text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950",
    activeColor: "bg-green-500 text-white border-green-500 hover:bg-green-600",
    type: "status",
    value: "В пути",
  },
  {
    id: "delivered-tk",
    label: "Доставлено в ТК",
    icon: <Truck className="h-3.5 w-3.5" />,
    color: "text-green-700 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-950",
    activeColor: "bg-green-600 text-white border-green-600 hover:bg-green-700",
    type: "status",
    value: "Доставлено в ТК",
  },
  {
    id: "in-accounting",
    label: "В бухгалтерии",
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950",
    activeColor: "bg-purple-500 text-white border-purple-500 hover:bg-purple-600",
    type: "status",
    value: "Счёт в Бухгалтерии",
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
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {QUICK_FILTERS.map((filter) => {
        const isActive = isFilterActive(filter);
        return (
          <Button
            key={filter.id}
            variant="outline"
            size="sm"
            onClick={() => toggleFilter(filter)}
            className={cn(
              "h-7 sm:h-8 text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 transition-all",
              isActive ? filter.activeColor : filter.color
            )}
          >
            {filter.icon}
            <span className="hidden xs:inline">{filter.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
