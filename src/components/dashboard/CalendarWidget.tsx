import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Request } from "@/hooks/useRequests";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { ru } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

interface CalendarWidgetProps {
  requests: Request[];
}

export function CalendarWidget({ requests }: CalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const isMobile = useIsMobile();

  // Получаем все даты доставки из заявок
  const deliveryDates = requests
    .filter(r => r.delivery_date)
    .map(r => new Date(r.delivery_date!));

  // Функция для определения, есть ли заявки на конкретную дату
  const hasDeliveryOnDate = (date: Date) => {
    return deliveryDates.some(
      deliveryDate =>
        deliveryDate.getDate() === date.getDate() &&
        deliveryDate.getMonth() === date.getMonth() &&
        deliveryDate.getFullYear() === date.getFullYear()
    );
  };

  // Получаем заявки для выбранной даты
  const requestsForSelectedDate = selectedDate
    ? requests.filter(r => {
        if (!r.delivery_date) return false;
        const deliveryDate = new Date(r.delivery_date);
        return (
          deliveryDate.getDate() === selectedDate.getDate() &&
          deliveryDate.getMonth() === selectedDate.getMonth() &&
          deliveryDate.getFullYear() === selectedDate.getFullYear()
        );
      })
    : [];

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Календарь доставок
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ru}
            numberOfMonths={isMobile ? 1 : 2}
            className="rounded-md border border-border/40 pointer-events-auto [&_.rdp-months]:flex [&_.rdp-months]:flex-col [&_.rdp-months]:sm:flex-row [&_.rdp-months]:gap-2 [&_.rdp-months]:sm:gap-4"
            modifiers={{
              delivery: deliveryDates,
            }}
            modifiersClassNames={{
              delivery: "font-bold bg-primary/20 text-primary hover:bg-primary/30",
            }}
          />
        </div>
        
        {selectedDate && requestsForSelectedDate.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Доставки на {selectedDate.toLocaleDateString("ru-RU")}:
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {requestsForSelectedDate.map((request) => (
                <div
                  key={request.id}
                  className="p-2 rounded-md border border-border/40 bg-muted/30"
                >
                  <p className="text-sm font-medium text-foreground">
                    {request.request_number}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {selectedDate && requestsForSelectedDate.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            Нет доставок на эту дату
          </p>
        )}
      </CardContent>
    </Card>
  );
}
