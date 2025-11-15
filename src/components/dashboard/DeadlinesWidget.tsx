import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Request } from "@/hooks/useRequests";
import { Calendar, AlertTriangle, Clock } from "lucide-react";
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { ru } from "date-fns/locale";

interface DeadlinesWidgetProps {
  requests: Request[];
}

export function DeadlinesWidget({ requests }: DeadlinesWidgetProps) {
  const upcomingRequests = requests
    .filter(r => r.delivery_date && r.status !== "Доставлено")
    .sort((a, b) => new Date(a.delivery_date!).getTime() - new Date(b.delivery_date!).getTime())
    .slice(0, 5);

  const getDeadlineStatus = (date: string) => {
    const deliveryDate = new Date(date);
    if (isPast(deliveryDate) && !isToday(deliveryDate)) {
      return { label: "Просрочено", color: "destructive" as const };
    }
    if (isToday(deliveryDate)) {
      return { label: "Сегодня", color: "default" as const };
    }
    if (isTomorrow(deliveryDate)) {
      return { label: "Завтра", color: "secondary" as const };
    }
    return { label: format(deliveryDate, "d MMM", { locale: ru }), color: "outline" as const };
  };

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Ближайшие дедлайны
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {upcomingRequests.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Нет заявок с датами доставки
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingRequests.map((request) => {
              const status = getDeadlineStatus(request.delivery_date!);
              const isOverdue = isPast(new Date(request.delivery_date!)) && !isToday(new Date(request.delivery_date!));
              
              return (
                <div
                  key={request.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50 ${
                    isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border/40"
                  }`}
                >
                  {isOverdue && (
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {request.request_number}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {request.description}
                    </p>
                  </div>
                  <Badge variant={status.color} className="text-xs whitespace-nowrap">
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
