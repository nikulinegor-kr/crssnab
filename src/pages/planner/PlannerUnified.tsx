import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addDays,
  endOfWeek,
  format,
  isPast,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePlannerTasks, type PlannerTask } from "@/hooks/usePlannerTasks";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { useOrgMembers, usePlannerMembers } from "@/hooks/useOrgMembers";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlannerTaskRow } from "@/components/planner/PlannerTaskRow";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import PlannerKanban from "./PlannerKanban";

type ViewKey = "today" | "week" | "all" | "mine" | "team";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "На неделю" },
  { key: "all", label: "Все задачи" },
  { key: "mine", label: "Мои задачи" },
  { key: "team", label: "Задачи сотрудников" },
];

export default function PlannerUnified() {
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as ViewKey) || "today";
  const employeeId = params.get("employee");
  const taskParam = params.get("task");

  const { data: tasks = [], isLoading } = usePlannerTasks();
  const filters = usePlannerFilters();
  const { data: members = [] } = useOrgMembers({ includeInactive: true });
  const { data: plannerMembers = [] } = usePlannerMembers();
  const { isAdmin } = useUserRole();

  const { data: currentUserId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 60_000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<PlannerTask | null>(null);

  // Deep link: /planner?task=<id>
  useEffect(() => {
    if (!taskParam || !tasks.length) return;
    const t = tasks.find((x) => x.id === taskParam);
    if (t) {
      setDialogTask(t);
      setDialogOpen(true);
    }
  }, [taskParam, tasks]);

  const setView = (v: ViewKey) => {
    const next = new URLSearchParams(params);
    next.set("view", v);
    if (v !== "team") next.delete("employee");
    setParams(next, { replace: true });
  };

  const setEmployee = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("view", "team");
    next.set("employee", id);
    setParams(next, { replace: true });
  };

  const scoped = useMemo(() => {
    const base = filters.apply(tasks);
    if (view === "mine") return base.filter((t) => t.assignee_id === currentUserId);
    if (view === "team")
      return base.filter((t) =>
        employeeId ? t.assignee_id === employeeId : !!t.assignee_id && t.assignee_id !== currentUserId
      );
    return base;
  }, [tasks, filters, view, currentUserId, employeeId]);

  const todayGroups = useMemo(() => {
    const active = scoped.filter((t) => t.status !== "done");
    const due = active.filter((t) => t.due_date && isToday(new Date(t.due_date)));
    const started = active.filter(
      (t) =>
        !due.includes(t) &&
        ((t.start_date && isToday(new Date(t.start_date))) || t.status === "in_progress")
    );
    const overdue = active.filter(
      (t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
    );
    return { due, started, overdue };
  }, [scoped]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return days.map((d) => ({
      date: d,
      tasks: scoped.filter((t) => t.due_date && isSameDay(new Date(t.due_date), d)),
      overdueBucket: false,
      end,
    }));
  }, [scoped]);

  const weekOverdue = useMemo(
    () =>
      scoped.filter(
        (t) =>
          t.status !== "done" &&
          t.due_date &&
          isPast(new Date(t.due_date)) &&
          !isToday(new Date(t.due_date))
      ),
    [scoped]
  );

  const openTask = (t: PlannerTask) => {
    setDialogTask(t);
    setDialogOpen(true);
  };

  const openNew = () => {
    setDialogTask(null);
    setDialogOpen(true);
  };

  const teamMembers = plannerMembers.filter((m) => m.user_id !== currentUserId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {VIEWS.map((v) => (
            <Button
              key={v.key}
              size="sm"
              variant={view === v.key ? "default" : "ghost"}
              className={cn("h-8 text-xs shrink-0", view !== v.key && "text-muted-foreground")}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        {view === "team" && isAdmin && (
          <Select value={employeeId ?? "__all__"} onValueChange={(v) => setEmployee(v)}>
            <SelectTrigger className="h-8 w-auto min-w-[190px] text-xs">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Все сотрудники</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button size="sm" className="ml-auto h-8" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Новая задача
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[60dvh] w-full" />
      ) : view === "today" ? (
        <div className="space-y-4">
          <TaskGroup title="Просроченные" tone="danger" tasks={todayGroups.overdue} members={members} onClick={openTask} />
          <TaskGroup title="Срок сегодня" tasks={todayGroups.due} members={members} onClick={openTask} />
          <TaskGroup title="В работе / начаты сегодня" tasks={todayGroups.started} members={members} onClick={openTask} />
          {todayGroups.overdue.length + todayGroups.due.length + todayGroups.started.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">На сегодня задач нет</p>
          )}
        </div>
      ) : view === "week" ? (
        <div className="space-y-3">
          {weekOverdue.length > 0 && (
            <TaskGroup title="Просроченные" tone="danger" tasks={weekOverdue} members={members} onClick={openTask} />
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {weekDays.map(({ date, tasks: dayTasks }) => (
              <Card
                key={date.toISOString()}
                className={cn("p-2 min-h-[140px]", isToday(date) && "border-primary/60 bg-primary/5")}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold capitalize">
                    {format(date, "EEEEEE", { locale: ru })} · {format(date, "d MMM", { locale: ru })}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{dayTasks.length}</Badge>
                </div>
                <div className="space-y-1">
                  {dayTasks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-1 py-2">Нет задач</p>
                  )}
                  {dayTasks.map((t) => (
                    <PlannerTaskRow
                      key={t.id}
                      task={t}
                      members={members}
                      onClick={openTask}
                      hideDate
                      className="rounded-md border border-border/50 px-2 py-1.5"
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <PlannerKanban
          hideHeader
          defaultAssigneeId={view === "mine" ? currentUserId ?? null : employeeId}
          taskFilter={(t) =>
            view === "mine"
              ? t.assignee_id === currentUserId
              : view === "team"
              ? employeeId
                ? t.assignee_id === employeeId
                : !!t.assignee_id && t.assignee_id !== currentUserId
              : true
          }
        />
      )}

      <PlannerTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={dialogTask} />
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  members,
  onClick,
  tone,
}: {
  title: string;
  tasks: PlannerTask[];
  members: any[];
  onClick: (t: PlannerTask) => void;
  tone?: "danger";
}) {
  if (!tasks.length) return null;
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "px-3 py-2 text-xs font-semibold border-b flex items-center gap-2",
          tone === "danger" ? "text-destructive bg-destructive/5" : "text-muted-foreground bg-muted/30"
        )}
      >
        {title}
        <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
      </div>
      <div className="divide-y divide-border/50">
        {tasks.map((t) => (
          <PlannerTaskRow key={t.id} task={t} members={members} onClick={onClick} />
        ))}
      </div>
    </Card>
  );
}
