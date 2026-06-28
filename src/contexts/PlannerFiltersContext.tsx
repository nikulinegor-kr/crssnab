import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlannerTask, PlannerTaskPriority } from "@/hooks/usePlannerTasks";

export type PlannerGroupBy = "none" | "object" | "equipment";

interface PlannerFiltersState {
  objectId: string | null;
  equipmentId: string | null;
  assigneeId: string | null;
  priority: PlannerTaskPriority | null;
  groupBy: PlannerGroupBy;
  setObjectId: (v: string | null) => void;
  setEquipmentId: (v: string | null) => void;
  setAssigneeId: (v: string | null) => void;
  setPriority: (v: PlannerTaskPriority | null) => void;
  setGroupBy: (v: PlannerGroupBy) => void;
  reset: () => void;
  hasActive: boolean;
  apply: (tasks: PlannerTask[]) => PlannerTask[];
}

const Ctx = createContext<PlannerFiltersState | null>(null);

export function PlannerFiltersProvider({ children }: { children: ReactNode }) {
  const [objectId, setObjectId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<PlannerTaskPriority | null>(null);
  const [groupBy, setGroupBy] = useState<PlannerGroupBy>("none");

  const value = useMemo<PlannerFiltersState>(() => {
    const hasActive =
      !!objectId || !!equipmentId || !!assigneeId || !!priority;
    return {
      objectId, equipmentId, assigneeId, priority, groupBy,
      setObjectId, setEquipmentId, setAssigneeId, setPriority, setGroupBy,
      hasActive,
      reset: () => {
        setObjectId(null); setEquipmentId(null);
        setAssigneeId(null); setPriority(null);
      },
      apply: (tasks) => tasks.filter((t) => {
        if (objectId && t.object_id !== objectId) return false;
        if (equipmentId && t.equipment_id !== equipmentId) return false;
        if (assigneeId && t.assignee_id !== assigneeId) return false;
        if (priority && t.priority !== priority) return false;
        return true;
      }),
    };
  }, [objectId, equipmentId, assigneeId, priority, groupBy]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlannerFilters(): PlannerFiltersState {
  const v = useContext(Ctx);
  if (!v) {
    // Safe defaults if not wrapped (e.g. embedded contexts)
    return {
      objectId: null, equipmentId: null, assigneeId: null, priority: null,
      groupBy: "none",
      setObjectId: () => {}, setEquipmentId: () => {},
      setAssigneeId: () => {}, setPriority: () => {}, setGroupBy: () => {},
      reset: () => {}, hasActive: false,
      apply: (tasks) => tasks,
    };
  }
  return v;
}
