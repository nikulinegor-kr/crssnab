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
      "Новая заявка": "bg-muted text-muted-foreground border-border",
      "В работе": "bg-warning/15 text-warning dark:text-warning border-warning/30",
      "На согласовании": "bg-info/15 text-info border-info/30",
      "КП": "bg-info/15 text-info border-info/30",
      "Счёт": "bg-info/15 text-info border-info/30",
      "Счёт в бухгалтерии": "bg-info/15 text-info border-info/30",
      "Счёт в Бухгалтерии": "bg-info/15 text-info border-info/30",
      "Оплачено": "bg-info/15 text-info dark:text-info border-info/30",
      "Готов к отгрузке": "bg-warning/15 text-warning dark:text-warning border-warning/30",
      "В пути": "bg-success/15 text-success dark:text-success border-success/30",
      "Доставлено в ТК": "bg-success/15 text-success dark:text-success border-success/30",
      "Доставлено": "bg-success/15 text-success dark:text-success border-success/30",
      "Выполнено": "bg-success/15 text-success dark:text-success border-success/30",
    };
    return styles[status] || "bg-muted text-muted-foreground border-border";
  };

  const getPriorityStyle = (priority: string | null) => {
    if (!priority) return null;
    const styles: Record<string, { className: string; label: string }> = {
      "Аварийно": { 
        className: "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30", 
        label: "Аварийная" 
      },
      "Приоритетно": { 
        className: "bg-warning/15 text-warning dark:text-warning border-warning/30", 
        label: "Приоритет" 
      },
      "Плановая": { 
        className: "bg-muted text-muted-foreground border-border", 
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
              <Check className="h-3 w-3 text-success" />
              <span className="text-success dark:text-success">Сохранено</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
