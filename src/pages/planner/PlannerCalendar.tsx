import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  usePlannerTasks,
  PRIORITY_META,
  type PlannerTask,
} from "@/hooks/usePlannerTasks";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { PlannerTaskMeta } from "@/components/planner/PlannerTaskMeta";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { cn } from "@/lib/utils";

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function PlannerCalendar() {
  const { data: allTasks = [], isLoading } = usePlannerTasks();
  const filters = usePlannerFilters();
  const tasks = useMemo(() => filters.apply(allTasks), [allTasks, filters]);
  const [cursor, setCursor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerTask | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    for (const t of tasks) {
      const d = t.due_date ?? t.start_date;
      if (!d) continue;
      const key = format(new Date(d), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const handleCreate = (date?: Date) => {
    setEditing(null);
    setPresetDate(date ? format(date, "yyyy-MM-dd") : null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold min-w-[160px] text-center capitalize">
            {format(cursor, "LLLL yyyy", { locale: ru })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Сегодня
          </Button>
        </div>
        <Button onClick={() => handleCreate()}>
          <Plus className="h-4 w-4 mr-1" /> Задача
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/40 border-b border-border/60">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-[11px] font-medium text-muted-foreground py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((d, i) => {
              const key = format(d, "yyyy-MM-dd");
              const items = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(d, cursor);
              return (
                <button
                  key={i}
                  onClick={() => handleCreate(d)}
                  className={cn(
                    "min-h-[88px] sm:min-h-[110px] text-left p-1.5 border-r border-b border-border/40 hover:bg-accent/30 transition relative",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                    (i + 1) % 7 === 0 && "border-r-0"
                  )}
                >
                  <div className={cn(
                    "text-[11px] font-medium font-numeric inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full",
                    isToday(d) && "bg-primary text-primary-foreground"
                  )}>
                    {format(d, "d")}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map((t) => {
                      const pr = PRIORITY_META[t.priority];
                      return (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(t);
                            setDialogOpen(true);
                          }}
                          className={cn(
                            "flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded truncate",
                            "bg-background border border-border/60 hover:border-primary/50"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
                          <span className={cn("truncate", t.status === "done" && "line-through opacity-60")}>
                            {t.title}
                          </span>
                        </div>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{items.length - 3}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PlannerTaskDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setPresetDate(null);
        }}
        task={editing}
        defaultDueDate={presetDate ?? undefined}
      />
    </div>
  );
}
