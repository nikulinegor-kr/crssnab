import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlannerTasks, PRIORITY_META } from "@/hooks/usePlannerTasks";

export function MyPlannerTasksWidget() {
  const { data: tasks = [], isLoading } = usePlannerTasks();

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const mine = useMemo(() => {
    return tasks
      .filter((t) => (t.assignee_id === userId || t.created_by === userId) && t.status !== "done")
      .sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      })
      .slice(0, 6);
  }, [tasks, userId]);

  const overdue = useMemo(() => mine.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length, [mine]);

  if (isLoading) {
    return <Card className="p-4"><Skeleton className="h-32 w-full" /></Card>;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Мои задачи</h3>
          <p className="text-[11px] text-muted-foreground">
            Активных: {mine.length}{overdue > 0 && <> · <span className="text-destructive">просрочено: {overdue}</span></>}
          </p>
        </div>
        <Link to="/planner/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
          Все <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {mine.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Нет активных задач</p>
      ) : (
        <ul className="space-y-1.5">
          {mine.map((t) => {
            const overdueT = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
            return (
              <li key={t.id}>
                <Link to="/planner/tasks" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                  {t.status === "in_progress" ? <Circle className="h-3.5 w-3.5 text-primary shrink-0" /> :
                   overdueT ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" /> :
                   <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="flex-1 text-sm truncate">{t.title}</span>
                  <Badge className={PRIORITY_META[t.priority].className + " text-[10px] shrink-0"}>
                    {PRIORITY_META[t.priority].label}
                  </Badge>
                  {t.due_date && (
                    <span className={`text-[11px] shrink-0 font-numeric ${overdueT ? "text-destructive" : "text-muted-foreground"}`}>
                      {format(new Date(t.due_date), "d MMM", { locale: ru })}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
