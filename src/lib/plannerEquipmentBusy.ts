import type { PlannerTask, PlannerTaskStatus } from "@/hooks/usePlannerTasks";

// Statuses that keep equipment busy. `done` is treated as released.
export const ACTIVE_STATUSES: PlannerTaskStatus[] = ["backlog", "todo", "in_progress", "review"];

export type EquipmentBusyStatus = "free" | "planned" | "working" | "overloaded";

export const BUSY_STATUS_META: Record<EquipmentBusyStatus, { label: string; dot: string; text: string; bg: string }> = {
  free:       { label: "Свободна",     dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  planned:    { label: "Запланирована", dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10" },
  working:    { label: "В работе",      dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-500/10" },
  overloaded: { label: "Перегружена",   dot: "bg-red-500",     text: "text-red-600 dark:text-red-400",         bg: "bg-red-500/10" },
};

const taskEquipmentIds = (t: PlannerTask): string[] =>
  t.equipment_ids?.length ? t.equipment_ids : (t.equipment_id ? [t.equipment_id] : []);

const bound = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

// Half-open [start, end]; if one bound is missing, we treat the task as
// open-ended on that side.
export const intervalsOverlap = (
  aStart: string | null | undefined, aEnd: string | null | undefined,
  bStart: string | null | undefined, bEnd: string | null | undefined,
): boolean => {
  const as = bound(aStart) ?? -Infinity;
  const ae = bound(aEnd) ?? Infinity;
  const bs = bound(bStart) ?? -Infinity;
  const be = bound(bEnd) ?? Infinity;
  // Missing both ends on a side means "no schedule" — do not conflict.
  if (as === -Infinity && ae === Infinity) return false;
  if (bs === -Infinity && be === Infinity) return false;
  return as <= be && bs <= ae;
};

export const isActive = (t: PlannerTask): boolean => ACTIVE_STATUSES.includes(t.status);

// Active tasks per equipment (excludes given taskId — used when editing).
export const activeTasksByEquipment = (tasks: PlannerTask[], excludeTaskId?: string | null) => {
  const map = new Map<string, PlannerTask[]>();
  for (const t of tasks) {
    if (excludeTaskId && t.id === excludeTaskId) continue;
    if (!isActive(t)) continue;
    for (const eid of taskEquipmentIds(t)) {
      const arr = map.get(eid) ?? [];
      arr.push(t);
      map.set(eid, arr);
    }
  }
  return map;
};

// Overall status of a single unit based on its active tasks.
export const equipmentStatusFromTasks = (tasks: PlannerTask[]): EquipmentBusyStatus => {
  if (tasks.length === 0) return "free";
  // Overloaded: 2+ tasks whose intervals overlap
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      if (intervalsOverlap(tasks[i].start_date, tasks[i].due_date, tasks[j].start_date, tasks[j].due_date)) {
        return "overloaded";
      }
    }
  }
  if (tasks.some((t) => t.status === "in_progress")) return "working";
  return "planned";
};

// Conflicts for a specific equipment against a target interval (new/edited task).
export const findEquipmentConflicts = (
  tasks: PlannerTask[],
  equipmentId: string,
  targetStart: string | null,
  targetEnd: string | null,
  excludeTaskId?: string | null,
): PlannerTask[] => {
  const bucket = activeTasksByEquipment(tasks, excludeTaskId).get(equipmentId) ?? [];
  // If target has no dates at all, don't warn.
  if (!targetStart && !targetEnd) return [];
  return bucket.filter((t) => intervalsOverlap(t.start_date, t.due_date, targetStart, targetEnd));
};
