import { useMemo, useState } from "react";
import { format, isToday, isPast, parseISO, startOfDay, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlannerTasks,
  useUpdatePlannerTask,
  type PlannerTask,
  type PlannerTaskPriority,
} from "@/hooks/usePlannerTasks";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { PlannerTaskMeta } from "@/components/planner/PlannerTaskMeta";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { usePlannerLookups } from "@/hooks/usePlannerEquipment";
import { Truck, MapPin } from "lucide-react";

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

function TaskRow({ task, onOpen }: { task: PlannerTask; onOpen: (t: PlannerTask) => void }) {
  const update = useUpdatePlannerTask();
  const done = task.status === "done";
  const dueTime = (task as any).due_time as string | null;

  return (
    <Card className="relative overflow-hidden p-3">
      <span className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_BAR[task.priority]}`} />
      <div className="pl-2 flex items-center gap-2">
        <button
          onClick={() => update.mutate({ id: task.id, patch: { status: done ? "todo" : "done" } as any })}
          className="shrink-0 rounded-full p-1 hover:bg-muted"
          aria-label="Готово"
        >
          <CheckCircle2 className={`h-5 w-5 ${done ? "text-green-600" : "text-muted-foreground"}`} />
        </button>
        <button onClick={() => onOpen(task)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{PRIORITY_DOT[task.priority]}</span>
            {dueTime && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Clock className="h-3 w-3" /> {dueTime.slice(0, 5)}
              </Badge>
            )}
            <span className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </span>
          </div>
          <PlannerTaskMeta equipmentId={task.equipment_id} objectId={task.object_id} className="mt-1" />
        </button>
      </div>
    </Card>
  );
}

function EquipmentByObjectBlock({ tasks }: { tasks: PlannerTask[] }) {
  const { equipmentMap, objectMap } = usePlannerLookups();
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of tasks) {
      if (!t.equipment_id) continue;
      const eq = equipmentMap.get(t.equipment_id);
      const objId = t.object_id || eq?.current_object_id;
      if (!objId) continue;
      const inner = map.get(objId) ?? new Map<string, number>();
      inner.set(t.equipment_id, (inner.get(t.equipment_id) ?? 0) + 1);
      map.set(objId, inner);
    }
    return Array.from(map.entries()).map(([oid, eqs]) => ({
      objectId: oid,
      objectName: objectMap.get(oid)?.name || "Объект",
      equipment: Array.from(eqs.entries()).map(([id, count]) => ({
        id,
        label: (() => { const e = equipmentMap.get(id); return e ? `${e.brand} ${e.model}`.trim() : "Техника"; })(),
        count,
      })),
    }));
  }, [tasks, equipmentMap, objectMap]);

  if (grouped.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Где сегодня работает техника</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {grouped.map((g) => (
          <div key={g.objectId} className="rounded-lg border border-border/60 p-3">
            <div className="text-xs font-semibold flex items-center gap-1.5 mb-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {g.objectName}
            </div>
            <ul className="space-y-1">
              {g.equipment.map((e) => (
                <li key={e.id} className="text-xs flex items-center gap-1.5">
                  <Truck className="h-3 w-3 text-muted-foreground" />
                  <span className="flex-1 truncate">{e.label}</span>
                  <Badge variant="secondary" className="text-[10px]">{e.count}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PlannerTodayManual() {
  const { data: rawTasks = [], isLoading } = usePlannerTasks();
  const filters = usePlannerFilters();
  const tasks = useMemo(() => filters.apply(rawTasks), [rawTasks, filters]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerTask | null>(null);

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const overdue = useMemo(
    () =>
      tasks.filter(
        (t) => t.status !== "done" && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)),
      ),
    [tasks],
  );
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date))),
    [tasks],
  );
  const critical = useMemo(
    () => tasks.filter((t) => t.status !== "done" && (t.priority === "critical" || t.priority === "urgent")),
    [tasks],
  );
  const done = todayTasks.filter((t) => t.status === "done").length;

  const openEdit = (t: PlannerTask) => {
    setEditing(t);
    setOpen(true);
  };
  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">Сегодня</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM", { locale: ru })} · {todayTasks.length} задач
          </p>
        </div>
        <Button onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" /> Новая задача
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Просрочено
          </div>
          <div className="text-2xl font-semibold mt-1">{overdue.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">🔴 Критических</div>
          <div className="text-2xl font-semibold mt-1">{critical.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5" /> На сегодня
          </div>
          <div className="text-2xl font-semibold mt-1">{todayTasks.length}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Выполнено
          </div>
          <div className="text-2xl font-semibold mt-1">{done}</div>
        </Card>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-red-600">Просрочено · {overdue.length}</div>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={openEdit} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Сегодня</div>
        {todayTasks.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">На сегодня задач нет</Card>
        ) : (
          todayTasks.map((t) => <TaskRow key={t.id} task={t} onOpen={openEdit} />)
        )}
      </div>

      <PlannerTaskDialog
        open={open}
        onOpenChange={setOpen}
        task={editing}
        defaultDueDate={format(today, "yyyy-MM-dd")}
      />
    </div>
  );
}
