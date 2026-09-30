import { useMemo, useState } from "react";
import { differenceInDays, startOfToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Request } from "@/hooks/useRequests";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NeedsActionWidgetProps {
  requests: Request[];
  onRequestClick: (request: Request) => void;
}

const CLOSED_STATUSES = new Set(["Доставлено", "Выполнено", "Отменено", "Закрыто"]);

export function NeedsActionWidget({ requests, onRequestClick }: NeedsActionWidgetProps) {
  const navigate = useNavigate();
  const [taskRequest, setTaskRequest] = useState<Request | null>(null);

  const matchingRequests = useMemo(
    () => requests
      .filter((request) =>
        !CLOSED_STATUSES.has(request.status)
        && (request.status === "Новая заявка" || request.priority === "Аварийно")
      )
      .sort((a, b) => {
        const priorityDifference = Number(b.priority === "Аварийно") - Number(a.priority === "Аварийно");
        if (priorityDifference !== 0) return priorityDifference;
        return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
      }),
    [requests],
  );

  const visibleRequests = matchingRequests.slice(0, 6);

  return (
    <>
      <Card className="overflow-hidden rounded-lg shadow-none">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4">
          <h2 className="text-[15px] font-semibold">Требует решения</h2>
          <span className="shrink-0 text-sm text-muted-foreground">
            <span className="font-numeric">{visibleRequests.length}</span> из <span className="font-numeric">{matchingRequests.length}</span>
          </span>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center border-t px-4 text-sm text-muted-foreground">
            Решать нечего
          </div>
        ) : (
          <div>
            {visibleRequests.map((request) => {
              const idleDays = Math.max(
                0,
                differenceInDays(startOfToday(), new Date(request.updated_at || request.created_at)),
              );
              const stateLabel = request.status === "Новая заявка" ? "новая" : request.status.toLocaleLowerCase("ru-RU");

              return (
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
                  className="flex min-h-16 cursor-pointer items-center gap-3 border-t px-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      request.priority === "Аварийно"
                        ? "bg-destructive"
                        : request.priority === "Приоритетно"
                          ? "bg-warning"
                          : "bg-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{request.description}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {request.priority || "Без приоритета"} · {stateLabel}, <span className="font-numeric">{idleDays}</span> дн. без движения
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="h-11 shrink-0 px-0 text-[13px] font-medium"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTaskRequest(request);
                    }}
                  >
                    Поставить задачу
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t px-4">
          <Button
            type="button"
            variant="link"
            className="h-11 px-0 text-[13px] font-medium"
            onClick={() => navigate("/requests?status=Новая заявка")}
          >
            Все новые в реестре →
          </Button>
        </div>
      </Card>

      <PlannerTaskDialog
        open={taskRequest !== null}
        onOpenChange={(open) => {
          if (!open) setTaskRequest(null);
        }}
        defaultTitle={taskRequest?.description}
        defaultRequestId={taskRequest?.id}
        defaultObjectId={taskRequest?.object_id}
        defaultDueDate={taskRequest?.delivery_date?.slice(0, 10)}
      />
    </>
  );
}