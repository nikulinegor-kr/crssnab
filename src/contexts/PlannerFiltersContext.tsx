import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlannerTask, PlannerTaskPriority } from "@/hooks/usePlannerTasks";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

export type PlannerGroupBy = "none" | "object" | "equipment";
export type PlannerPeriod = "all" | "today" | "week" | "overdue";

interface PlannerFiltersState {
  period: PlannerPeriod;
  setPeriod: (v: PlannerPeriod) => void;
  objectId: string | null;
  equipmentId: string | null;
  assigneeId: string | null;
  priority: PlannerTaskPriority | null;
  groupBy: PlannerGroupBy;
  searchQuery: string;
  setObjectId: (v: string | null) => void;
  setEquipmentId: (v: string | null) => void;
  setAssigneeId: (v: string | null) => void;
  setPriority: (v: PlannerTaskPriority | null) => void;
  setGroupBy: (v: PlannerGroupBy) => void;
  setSearchQuery: (v: string) => void;
  reset: () => void;
  hasActive: boolean;
  apply: (tasks: PlannerTask[]) => PlannerTask[];
}

const Ctx = createContext<PlannerFiltersState | null>(null);

export function PlannerFiltersProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<PlannerPeriod>("all");
  const [objectId, setObjectId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<PlannerTaskPriority | null>(null);
  const [groupBy, setGroupBy] = useState<PlannerGroupBy>("none");
  const [searchQuery, setSearchQuery] = useState("");

  const { equipmentMap, objectMap } = usePlannerLookups();
  const { data: members = [] } = useOrgMembers();
  const { currentOrgId } = useCurrentOrganization();

  // Lightweight requests lookup used for cross-field search
  const { data: requestsIndex = [] } = useQuery({
    queryKey: ["planner-search-requests", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("requests")
        .select("id, description, executor, contractor, applicant, request_number")
        .eq("organization_id", currentOrgId)
        .limit(2000);
      return data ?? [];
    },
    enabled: !!currentOrgId,
    staleTime: 60_000,
  });

  const value = useMemo<PlannerFiltersState>(() => {
    const hasActive =
      period !== "all" || !!objectId || !!equipmentId || !!assigneeId || !!priority || !!searchQuery.trim();

    const requestById = new Map<string, any>();
    for (const r of requestsIndex) requestById.set((r as any).id, r);
    const memberById = new Map(members.map((m) => [m.user_id, m]));

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    return {
      period, setPeriod,
      objectId, equipmentId, assigneeId, priority, groupBy, searchQuery,
      setObjectId, setEquipmentId, setAssigneeId, setPriority, setGroupBy, setSearchQuery,
      hasActive,
      reset: () => {
        setPeriod("all");
        setObjectId(null); setEquipmentId(null);
        setAssigneeId(null); setPriority(null);
        setSearchQuery("");
      },
      apply: (tasks) => tasks.filter((t) => {
        if (period !== "all") {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
          const due = t.due_date ? new Date(t.due_date).getTime() : null;
          if (period === "overdue") {
            if (t.status === "done" || due === null || due >= startOfToday) return false;
          } else if (period === "today") {
            if (due === null || due > endOfToday) return false;
            if (due < startOfToday && t.status === "done") return false;
          } else if (period === "week") {
            const endOfWeek = endOfToday + 6 * 24 * 60 * 60 * 1000;
            if (due === null || due > endOfWeek) return false;
            if (due < startOfToday && t.status === "done") return false;
          }
        }
        if (objectId) {
          const tObj = t.object_id
            || (t.equipment_id ? equipmentMap.get(t.equipment_id)?.current_object_id : null)
            || null;
          if (tObj !== objectId) return false;
        }
        if (equipmentId) {
          const ids = t.equipment_ids?.length ? t.equipment_ids : (t.equipment_id ? [t.equipment_id] : []);
          if (!ids.includes(equipmentId)) return false;
        }
        if (assigneeId && t.assignee_id !== assigneeId) return false;
        if (priority && t.priority !== priority) return false;

        if (terms.length > 0) {
          const parts: string[] = [t.title || "", t.description || ""];
          const oid = t.object_id
            || (t.equipment_id ? equipmentMap.get(t.equipment_id)?.current_object_id : null);
          if (oid) parts.push(objectMap.get(oid)?.name || "");
          const eqIds = t.equipment_ids?.length ? t.equipment_ids : (t.equipment_id ? [t.equipment_id] : []);
          for (const eid of eqIds) {
            const eq = equipmentMap.get(eid);
            if (eq) parts.push(equipmentLabel(eq), eq.plate_number || "", eq.vin || "", eq.responsible_name || "");
          }
          if (t.assignee_id) {
            const m = memberById.get(t.assignee_id);
            if (m) parts.push(m.full_name || "", m.email || "");
          }
          if (t.request_id) {
            const r = requestById.get(t.request_id);
            if (r) parts.push(r.description || "", r.executor || "", r.contractor || "", r.applicant || "", r.request_number || "");
          }
          const hay = parts.join(" ").toLowerCase();
          if (!terms.every((term) => hay.includes(term))) return false;
        }
        return true;
      }),
    };
  }, [period, objectId, equipmentId, assigneeId, priority, groupBy, searchQuery, equipmentMap, objectMap, members, requestsIndex]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlannerFilters(): PlannerFiltersState {
  const v = useContext(Ctx);
  if (!v) {
    return {
      period: "all", setPeriod: () => {},
      objectId: null, equipmentId: null, assigneeId: null, priority: null,
      groupBy: "none", searchQuery: "",
      setObjectId: () => {}, setEquipmentId: () => {},
      setAssigneeId: () => {}, setPriority: () => {}, setGroupBy: () => {},
      setSearchQuery: () => {},
      reset: () => {}, hasActive: false,
      apply: (tasks) => tasks,
    };
  }
  return v;
}
