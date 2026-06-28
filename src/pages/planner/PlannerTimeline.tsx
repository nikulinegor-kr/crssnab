import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { usePlannerTasks, PRIORITY_META, type PlannerTask } from "@/hooks/usePlannerTasks";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { PlannerTaskMeta } from "@/components/planner/PlannerTaskMeta";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { cn } from "@/lib/utils";

const DAY_W = 40;
const ROW_H = 36;
const RANGE_DAYS = 28;

export default function PlannerTimeline() {
  const { data: tasks = [], isLoading } = usePlannerTasks();
  const [cursor, setCursor] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerTask | null>(null);

  const start = startOfDay(cursor);
  const end = addDays(start, RANGE_DAYS - 1);
  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);

  const rows = useMemo(() => {
    return tasks
      .filter((t) => t.start_date || t.due_date)
      .map((t) => {
        const s = startOfDay(new Date(t.start_date ?? t.due_date!));
        const e = startOfDay(new Date(t.due_date ?? t.start_date!));
        return { task: t, s, e };
      })
      .filter(({ s, e }) => e >= start && s <= end)
      .sort((a, b) => a.s.getTime() - b.s.getTime());
  }, [tasks, start, end]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold min-w-[200px] text-center">
            {format(start, "d MMM", { locale: ru })} — {format(end, "d MMM yyyy", { locale: ru })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addDays(cursor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Сегодня
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:block">
          Задачи с датами начала или окончания
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[400px]" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          Нет задач с датами в выбранном диапазоне
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <div className="flex" style={{ minWidth: 240 + DAY_W * RANGE_DAYS }}>
              {/* Left column */}
              <div className="w-[240px] shrink-0 border-r border-border/60 bg-muted/30">
                <div className="h-10 border-b border-border/60 px-3 flex items-center text-[11px] font-medium text-muted-foreground">
                  Задача
                </div>
                {rows.map(({ task }) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setEditing(task);
                      setDialogOpen(true);
                    }}
                    style={{ height: ROW_H }}
                    className="w-full px-3 text-left text-xs flex items-center gap-2 border-b border-border/40 hover:bg-accent/40 transition truncate"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_META[task.priority].dot)} />
                    <span className={cn("truncate", task.status === "done" && "line-through text-muted-foreground")}>
                      {task.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="relative flex-1">
                <div className="flex h-10 border-b border-border/60">
                  {days.map((d) => (
                    <div
                      key={d.toISOString()}
                      style={{ width: DAY_W }}
                      className={cn(
                        "shrink-0 text-center text-[10px] flex flex-col items-center justify-center border-r border-border/30",
                        isToday(d) && "bg-primary/10 text-primary font-semibold"
                      )}
                    >
                      <span className="text-muted-foreground uppercase">
                        {format(d, "EE", { locale: ru })}
                      </span>
                      <span className="font-numeric">{format(d, "d")}</span>
                    </div>
                  ))}
                </div>

                {rows.map(({ task, s, e }) => {
                  const offset = Math.max(0, differenceInCalendarDays(s, start));
                  const span = Math.min(
                    RANGE_DAYS - offset,
                    differenceInCalendarDays(e, s < start ? start : s) + 1
                  );
                  const pr = PRIORITY_META[task.priority];
                  return (
                    <div
                      key={task.id}
                      style={{ height: ROW_H }}
                      className="relative border-b border-border/40 flex"
                    >
                      {days.map((d) => (
                        <div
                          key={d.toISOString()}
                          style={{ width: DAY_W }}
                          className={cn(
                            "shrink-0 border-r border-border/20",
                            isToday(d) && "bg-primary/5"
                          )}
                        />
                      ))}
                      <button
                        onClick={() => {
                          setEditing(task);
                          setDialogOpen(true);
                        }}
                        style={{
                          left: offset * DAY_W + 2,
                          width: Math.max(span * DAY_W - 4, DAY_W - 4),
                          top: 6,
                          height: ROW_H - 12,
                        }}
                        className={cn(
                          "absolute rounded-md text-[10px] font-medium px-2 truncate text-left transition hover:opacity-90 border",
                          pr.className,
                          task.status === "done" && "opacity-60 line-through"
                        )}
                      >
                        {task.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <PlannerTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
    </div>
  );
}
