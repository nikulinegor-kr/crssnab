import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, KanbanSquare, ListTodo, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";
import { usePlannerTasks, PRIORITY_META, PLANNER_COLUMNS } from "@/hooks/usePlannerTasks";
import { format, isPast, isToday, isAfter, startOfDay, differenceInCalendarDays } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function PlannerDashboard() {
  const { data: tasks = [], isLoading } = usePlannerTasks();

  const stats = useMemo(() => {
    const today = tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)) && t.status !== "done");
    const overdue = tasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "done");
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const done = tasks.filter((t) => t.status === "done");
    const tomorrow = startOfDay(new Date());
    const upcoming = tasks
      .filter((t) => t.status !== "done" && t.due_date && isAfter(new Date(t.due_date), tomorrow) && !isToday(new Date(t.due_date)))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    return { today, overdue, inProgress, done, upcoming };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarClock} label="На сегодня" value={stats.today.length} tone="primary" />
        <StatCard icon={AlertTriangle} label="Просрочено" value={stats.overdue.length} tone="destructive" />
        <StatCard icon={ListTodo} label="В работе" value={stats.inProgress.length} tone="orange" />
        <StatCard icon={CheckCircle2} label="Готово" value={stats.done.length} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Сегодняшние задачи</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/planner/board">
                <KanbanSquare className="h-4 w-4 mr-1" /> Доска задач
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.today.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Свободный день 🎉</p>
            ) : (
              stats.today.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Просрочено
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Всё под контролем</p>
            ) : (
              stats.overdue.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Ближайшие задачи
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="../calendar" relative="path">Календарь</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Нет запланированных задач</p>
          ) : (
            stats.upcoming.slice(0, 8).map((t) => <UpcomingRow key={t.id} task={t} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">По колонкам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PLANNER_COLUMNS.map((col) => {
              const count = tasks.filter((t) => t.status === col.id).length;
              return (
                <Link
                  key={col.id}
                  to="/planner/board"
                  className="rounded-lg border border-border/60 px-3 py-3 hover:border-primary/50 hover:bg-accent/40 transition"
                >
                  <div className="text-xs text-muted-foreground">{col.title}</div>
                  <div className="text-2xl font-semibold font-numeric mt-1">{count}</div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "destructive" | "orange" | "success";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    orange: "bg-orange-500/10 text-orange-500",
    success: "bg-emerald-500/10 text-emerald-500",
  } as const;
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-semibold font-numeric leading-none mt-1">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: any }) {
  const pr = PRIORITY_META[task.priority as keyof typeof PRIORITY_META];
  const due = task.due_date ? new Date(task.due_date) : null;
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/40 transition">
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
      <span className="flex-1 text-sm truncate">{task.title}</span>
      {due && (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-numeric">
          {format(due, "d MMM", { locale: ru })}
        </Badge>
      )}
    </div>
  );
}

function UpcomingRow({ task }: { task: any }) {
  const pr = PRIORITY_META[task.priority as keyof typeof PRIORITY_META];
  const due = new Date(task.due_date);
  const days = differenceInCalendarDays(due, new Date());
  const rel =
    days === 1 ? "завтра" :
    days <= 7 ? `через ${days} дн.` :
    format(due, "d MMM", { locale: ru });
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/40 transition">
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
      <span className="flex-1 text-sm truncate">{task.title}</span>
      <span className="text-[11px] text-muted-foreground font-numeric shrink-0">
        {format(due, "d MMM", { locale: ru })}
      </span>
      <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">{rel}</Badge>
    </div>
  );
}
