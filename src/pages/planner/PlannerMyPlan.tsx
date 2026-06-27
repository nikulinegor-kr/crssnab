import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  PRIORITY_META,
  type PlannerTask,
  type PlannerTaskPriority,
  useUpdatePlannerTask,
} from "@/hooks/usePlannerTasks";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListChecks,
  MapPin,
  Plus,
  Wrench,
  AlertTriangle,
  CalendarRange,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  startOfWeek,
  endOfWeek,
  isBefore,
  parseISO,
} from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type View = "today" | "tomorrow" | "this-week" | "next-week" | "calendar" | "list";

const PRIORITY_BAR: Record<PlannerTaskPriority, string> = {
  critical: "bg-red-500",
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

const PRIORITY_DOT: Record<PlannerTaskPriority, string> = {
  critical: "🔴",
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const PRIORITY_ORDER: Record<PlannerTaskPriority, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

interface RangeFilter {
  from?: Date;
  to?: Date;
  includeOverdue?: boolean;
}

function rangeForView(view: View): RangeFilter {
  const today = startOfDay(new Date());
  switch (view) {
    case "today":
      return { from: today, to: endOfDay(today), includeOverdue: true };
    case "tomorrow": {
      const t = addDays(today, 1);
      return { from: t, to: endOfDay(t) };
    }
    case "this-week":
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
      };
    case "next-week": {
      const next = addDays(today, 7);
      return {
        from: startOfWeek(next, { weekStartsOn: 1 }),
        to: endOfWeek(next, { weekStartsOn: 1 }),
      };
    }
    default:
      return {};
  }
}

function sortTasks(a: PlannerTask, b: PlannerTask): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 9;
  const pb = PRIORITY_ORDER[b.priority] ?? 9;
  if (pa !== pb) return pa - pb;
  const ta = (a as any).due_time ?? "99:99";
  const tb = (b as any).due_time ?? "99:99";
  if (ta !== tb) return ta.localeCompare(tb);
  const da = a.due_date ?? "9999";
  const db = b.due_date ?? "9999";
  return da.localeCompare(db);
}

function useMyTasks() {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-my-tasks", currentOrgId],
    queryFn: async (): Promise<PlannerTask[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("planner_tasks")
        .select("*")
        .eq("organization_id", currentOrgId)
        .or("source.is.null,source.eq.manual")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as unknown) as PlannerTask[];
    },
    enabled: !!currentOrgId,
  });
}

function TaskCard({
  task,
  objects,
  equipment,
  onOpen,
}: {
  task: PlannerTask;
  objects: Map<string, string>;
  equipment: Map<string, string>;
  onOpen: (t: PlannerTask) => void;
}) {
  const update = useUpdatePlannerTask();
  const done = task.status === "done";
  const dueTime = (task as any).due_time as string | null;
  const overdue =
    !done &&
    task.due_date &&
    isBefore(parseISO(task.due_date), startOfDay(new Date()));
  const checklist = task.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;

  const complete = async () => {
    await update.mutateAsync({ id: task.id, patch: { status: "done" } as any });
    toast.success("Задача выполнена");
  };

  const postpone = async (days: number) => {
    const base = task.due_date ? parseISO(task.due_date) : new Date();
    const next = addDays(base, days);
    await update.mutateAsync({
      id: task.id,
      patch: { due_date: next.toISOString() } as any,
    });
    toast.success(`Перенесено на ${format(next, "d MMM", { locale: ru })}`);
  };

  const setPriority = async (p: PlannerTaskPriority) => {
    await update.mutateAsync({ id: task.id, patch: { priority: p } as any });
  };

  return (
    <Card
      className={`relative overflow-hidden p-3 sm:p-4 ${
        done ? "opacity-60" : ""
      }`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1.5 ${PRIORITY_BAR[task.priority]}`}
      />
      <div className="pl-2 space-y-2.5">
        <div className="flex items-start gap-2">
          <button
            onClick={complete}
            className="shrink-0 mt-0.5 rounded-full p-1 hover:bg-muted"
            aria-label="Выполнено"
          >
            <CheckCircle2
              className={`h-6 w-6 ${done ? "text-green-600" : "text-muted-foreground"}`}
            />
          </button>
          <button
            onClick={() => onOpen(task)}
            className="flex-1 text-left"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{PRIORITY_DOT[task.priority]}</span>
              {dueTime && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" /> {dueTime.slice(0, 5)}
                </Badge>
              )}
              {overdue && (
                <Badge variant="destructive" className="text-xs">
                  Просрочено
                </Badge>
              )}
            </div>
            <div
              className={`text-sm sm:text-base font-medium mt-1 ${
                done ? "line-through" : ""
              }`}
            >
              {task.title}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              {task.object_id && objects.get(task.object_id) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {objects.get(task.object_id)}
                </span>
              )}
              {task.equipment_id && equipment.get(task.equipment_id) && (
                <span className="inline-flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> {equipment.get(task.equipment_id)}
                </span>
              )}
              {task.due_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(parseISO(task.due_date), "d MMM", { locale: ru })}
                </span>
              )}
              {checklist.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> {checklistDone}/
                  {checklist.length}
                </span>
              )}
            </div>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 min-w-[110px]"
            onClick={complete}
          >
            Выполнено
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 min-w-[110px]"
              >
                Перенести <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => postpone(1)}>
                На завтра
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => postpone(2)}>
                На послезавтра
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => postpone(7)}>
                На неделю
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 min-w-[110px]"
              >
                Приоритет <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.keys(PRIORITY_DOT) as PlannerTaskPriority[])
                .filter((p) => p !== "urgent")
                .map((p) => (
                  <DropdownMenuItem key={p} onClick={() => setPriority(p)}>
                    {PRIORITY_DOT[p]} {PRIORITY_META[p].label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="default"
            className="h-9 flex-1 min-w-[110px]"
            onClick={() => onOpen(task)}
          >
            Открыть
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function PlannerMyPlan() {
  const { currentOrgId } = useCurrentOrganization();
  const { data: tasks = [] } = useMyTasks();
  const [view, setView] = useState<View>("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const navigate = useNavigate();

  const { data: objectsList = [] } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId);
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });
  const { data: equipmentList = [] } = useQuery({
    queryKey: ["planner-equipment-map", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("equipment")
        .select("id, name")
        .eq("organization_id", currentOrgId);
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });
  const objectsMap = useMemo(
    () => new Map((objectsList as any[]).map((o) => [o.id, o.name])),
    [objectsList],
  );
  const equipmentMap = useMemo(
    () => new Map((equipmentList as any[]).map((e) => [e.id, e.name])),
    [equipmentList],
  );

  const today = startOfDay(new Date());
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due_date &&
      isBefore(parseISO(t.due_date), today),
  );
  const todayTasks = tasks.filter(
    (t) =>
      t.due_date &&
      format(parseISO(t.due_date), "yyyy-MM-dd") ===
        format(today, "yyyy-MM-dd"),
  );
  const criticalTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      (t.priority === "critical" || t.priority === "urgent"),
  );

  const filtered = useMemo(() => {
    if (view === "list") {
      return [...tasks].sort(sortTasks);
    }
    if (view === "calendar") {
      return [...tasks].sort(sortTasks);
    }
    const { from, to, includeOverdue } = rangeForView(view);
    return tasks
      .filter((t) => {
        if (!t.due_date) return false;
        const d = parseISO(t.due_date);
        if (includeOverdue && t.status !== "done" && isBefore(d, today))
          return true;
        if (from && to) return d >= from && d <= to;
        return false;
      })
      .sort(sortTasks);
  }, [tasks, view, today]);

  const calendarGroups = useMemo(() => {
    if (view !== "calendar") return [];
    const map = new Map<string, PlannerTask[]>();
    for (const t of filtered) {
      const key = t.due_date
        ? format(parseISO(t.due_date), "yyyy-MM-dd")
        : "Без даты";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, view]);

  const openCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };
  const openEdit = (t: PlannerTask) => {
    setEditingTask(t);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Просрочено
          </div>
          <div className="text-2xl font-semibold mt-1">
            {overdueTasks.length}
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            🔴 Критических
          </div>
          <div className="text-2xl font-semibold mt-1">
            {criticalTasks.length}
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5" /> На сегодня
          </div>
          <div className="text-2xl font-semibold mt-1">{todayTasks.length}</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" /> Всего активных
          </div>
          <div className="text-2xl font-semibold mt-1">
            {tasks.filter((t) => t.status !== "done").length}
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-semibold">Мой план</h2>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" /> Новая задача
        </Button>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="today">Сегодня</TabsTrigger>
          <TabsTrigger value="tomorrow">Завтра</TabsTrigger>
          <TabsTrigger value="this-week">Эта неделя</TabsTrigger>
          <TabsTrigger value="next-week">Следующая неделя</TabsTrigger>
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
          <TabsTrigger value="list">Список</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-4">
          {view === "calendar" ? (
            <div className="space-y-4">
              {calendarGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет задач
                </p>
              )}
              {calendarGroups.map(([day, items]) => (
                <div key={day} className="space-y-2">
                  <div className="text-sm font-semibold text-muted-foreground sticky top-0 bg-background/80 backdrop-blur py-1">
                    {day === "Без даты"
                      ? day
                      : format(parseISO(day), "EEEE, d MMMM", { locale: ru })}
                  </div>
                  {items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      objects={objectsMap}
                      equipment={equipmentMap}
                      onOpen={openEdit}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет задач в этом периоде
                </p>
              )}
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  objects={objectsMap}
                  equipment={equipmentMap}
                  onOpen={openEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PlannerTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
      />
    </div>
  );
}
