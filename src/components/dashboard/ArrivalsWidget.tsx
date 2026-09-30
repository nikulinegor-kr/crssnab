import { useMemo } from "react";
import { addDays, format, isWithinInterval, startOfDay, startOfToday } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { Request } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ArrivalsWidgetProps {
  requests: Request[];
  onRequestClick: (request: Request) => void;
}

type RequestWithObject = Request & { object_name?: string | null };

const CLOSED_STATUSES = new Set(["Доставлено", "Выполнено", "Отменено", "Закрыто"]);

export function ArrivalsWidget({ requests, onRequestClick }: ArrivalsWidgetProps) {
  const navigate = useNavigate();
  const today = useMemo(() => startOfToday(), []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(today, index)), [today]);

  const arrivals = useMemo(
    () => (requests as RequestWithObject[])
      .filter((request) => {
        if (CLOSED_STATUSES.has(request.status) || !request.delivery_date) return false;
        const deliveryDate = startOfDay(new Date(request.delivery_date));
        return isWithinInterval(deliveryDate, { start: today, end: addDays(today, 13) });
      })
      .sort((a, b) => new Date(a.delivery_date ?? 0).getTime() - new Date(b.delivery_date ?? 0).getTime()),
    [requests, today],
  );

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    arrivals.forEach((request) => {
      if (!request.delivery_date) return;
      const key = format(new Date(request.delivery_date), "yyyy-MM-dd");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [arrivals]);

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4">
        <h2 className="text-[15px] font-semibold">Приходы на 14 дней</h2>
        <span className="shrink-0 text-sm text-muted-foreground">
          <span className="font-numeric">{arrivals.length}</span> поставок
        </span>
      </div>

      <div className="overflow-x-auto px-4 pb-4">
        <div className="grid min-w-[560px] gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {days.map((day, index) => {
            const count = countsByDay.get(format(day, "yyyy-MM-dd")) ?? 0;
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const barHeight = count === 0 ? 3 : Math.min(count * 16, 66);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg py-2",
                  index === 0 && "bg-primary/10",
                  weekend && "text-muted-foreground",
                )}
              >
                <span className="h-4 font-numeric text-xs font-semibold">{count || ""}</span>
                <div className="flex h-[66px] w-full items-end justify-center">
                  <span
                    className={cn("w-3 rounded-sm", count === 0 ? "bg-border" : "bg-primary")}
                    style={{ height: `${barHeight}px` }}
                  />
                </div>
                <span className="font-numeric text-xs">{format(day, "d")}</span>
                <span className="text-xs">{format(day, "EEEEEE", { locale: ru })}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t px-4 pt-3">
        <p className="pb-2 text-[13px] font-semibold text-muted-foreground">Ближайшие поставки</p>
        {arrivals.slice(0, 5).map((request) => (
          <div
            key={request.id}
            role="button"
            tabIndex={0}
            onClick={() => onRequestClick(request)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRequestClick(request);
              }
            }}
            className="grid h-11 cursor-pointer grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 border-t transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[48px_minmax(0,1fr)_minmax(0,0.75fr)_auto]"
          >
            <span className="font-numeric text-[13px]">
              {request.delivery_date ? format(new Date(request.delivery_date), "dd.MM") : "—"}
            </span>
            <span className="truncate text-sm">{request.description}</span>
            <span className="hidden truncate text-[13px] text-muted-foreground md:block">{request.object_name || "—"}</span>
            <span className="whitespace-nowrap text-right font-numeric text-[13px]">
              {request.amount.toLocaleString("ru-RU")} ₽
            </span>
          </div>
        ))}
      </div>

      <div className="border-t px-4">
        <Button
          type="button"
          variant="link"
          className="h-11 px-0 text-[13px] font-medium"
          onClick={() => navigate("/requests?filter=upcomingNext7Days")}
        >
          Приходы на 7 дней в реестре →
        </Button>
      </div>
    </Card>
  );
}