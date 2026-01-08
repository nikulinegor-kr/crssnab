import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { Package } from "lucide-react";
import { format, isAfter, startOfToday, isBefore, addDays } from "date-fns";
import { ru } from "date-fns/locale";

interface UpcomingDeliveriesWidgetProps {
  requests: Request[];
  onRequestClick?: (request: Request) => void;
}

export function UpcomingDeliveriesWidget({ requests, onRequestClick }: UpcomingDeliveriesWidgetProps) {
  const today = startOfToday();
  const nextWeek = addDays(today, 7);

  // Фильтруем заявки с датой доставки и сортируем по дате
  const upcomingDeliveries = requests
    .filter(r => {
      if (!r.delivery_date || r.status === "Доставлено") return false;
      const deliveryDate = new Date(r.delivery_date);
      return isAfter(deliveryDate, addDays(today, -1)); // Включаем сегодняшние
    })
    .sort((a, b) => {
      const dateA = new Date(a.delivery_date!);
      const dateB = new Date(b.delivery_date!);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  const getDateColor = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isBefore(date, today)) return "text-destructive"; // Просрочено
    if (isBefore(date, addDays(today, 3))) return "text-warning"; // Скоро
    return "text-success"; // Норма
  };

  return (
    <Card className="bg-card border-border/40 shadow-sm border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 bg-primary/5">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Ближайшие поставки ТМЦ
        </CardTitle>
        <Package className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="pt-4">
        {upcomingDeliveries.length > 0 ? (
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {upcomingDeliveries.map((request) => (
              <div
                key={request.id}
                onClick={() => onRequestClick?.(request)}
                className="flex items-center justify-between p-2 rounded-md border border-border/40 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {request.request_number}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.description}
                  </p>
                </div>
                <div className={`text-sm font-semibold whitespace-nowrap ${getDateColor(request.delivery_date!)}`}>
                  {format(new Date(request.delivery_date!), "dd MMM", { locale: ru })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет запланированных поставок
          </p>
        )}
      </CardContent>
    </Card>
  );
}
