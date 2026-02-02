import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Truck, Package, Loader2, Check } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RequestStickyHeaderProps {
  requestNumber: string;
  status: string;
  priority: string | null;
  shipmentDate: string | null;
  deliveryDate: string | null;
  isSaving?: boolean;
}

export function RequestStickyHeader({
  requestNumber,
  status,
  priority,
  shipmentDate,
  deliveryDate,
  isSaving = false,
}: RequestStickyHeaderProps) {
  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      "Новая заявка": "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
      "В работе": "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
      "На согласовании": "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
      "КП": "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
      "Счёт": "bg-gray-400/15 text-gray-500 dark:text-gray-400 border-gray-400/30",
      "Счёт в бухгалтерии": "bg-gray-400/15 text-gray-500 dark:text-gray-400 border-gray-400/30",
      "Оплачено": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
      "В пути": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
      "Доставлено в ТК": "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30",
      "Доставлено": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      "Выполнено": "bg-green-700/15 text-green-800 dark:text-green-300 border-green-700/30",
    };
    return styles[status] || "bg-muted text-muted-foreground border-border";
  };

  const getPriorityStyle = (priority: string | null) => {
    if (!priority) return null;
    const styles: Record<string, { className: string; label: string }> = {
      "Аварийно": { 
        className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", 
        label: "Аварийная" 
      },
      "Приоритетно": { 
        className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30", 
        label: "Приоритет" 
      },
      "Плановая": { 
        className: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30", 
        label: "Плановая" 
      },
    };
    return styles[priority] || null;
  };

  const priorityStyle = getPriorityStyle(priority);

  return (
    <div className="sticky top-0 z-40 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {/* Request number */}
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">#{requestNumber}</span>
        </div>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Status badge */}
        <Badge 
          variant="outline" 
          className={cn("font-medium", getStatusStyle(status))}
        >
          {status}
        </Badge>

        {/* Priority badge */}
        {priorityStyle && (
          <Badge 
            variant="outline" 
            className={cn("font-medium", priorityStyle.className)}
          >
            {priorityStyle.label}
          </Badge>
        )}

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Key dates */}
        <div className="flex items-center gap-4 text-sm">
          {shipmentDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Отправка:</span>
              <span className="font-medium text-foreground">
                {format(new Date(shipmentDate), "dd.MM", { locale: ru })}
              </span>
            </div>
          )}
          {deliveryDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Доставка:</span>
              <span className="font-medium text-foreground">
                {format(new Date(deliveryDate), "dd.MM", { locale: ru })}
              </span>
            </div>
          )}
        </div>

        {/* Auto-save indicator - pushed to right */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Сохраняется...</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Сохранено</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
