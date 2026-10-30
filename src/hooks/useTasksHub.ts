import { useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useTaskHubIdentity } from "./useTaskHubIdentity";
import { applyTabFilter, type TaskTab } from "@/lib/taskHub";
import { invalidatePlannerTaskQueries, type PlannerTask } from "./usePlannerTasks";

export interface HubFilters { search: string; object: string; assignee: string; priority: string; department: string }
export function useTasksHub(tab: TaskTab, filters: HubFilters, page: number) {
  const { currentOrgId } = useCurrentOrganization();
  const { userId } = useTaskHubIdentity();
  const today = startOfDay(new Date()).toISOString();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["task-hub", currentOrgId, userId, tab, filters, page, format(new Date(), "yyyy-MM-dd")],
    enabled: !!currentOrgId && !!userId,
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === currentOrgId && previousQuery?.queryKey[2] === userId ? keepPreviousData(previous) : undefined,
    queryFn: async () => {
      if (!currentOrgId || !userId) return { rows: [] as PlannerTask[], count: 0 };
      let query = applyTabFilter(supabase.from("planner_tasks").select("*", { count: "exact" }).eq("organization_id", currentOrgId), tab, userId, today);
      for (const term of filters.search.trim().split(/\s+/).filter(Boolean)) query = query.ilike("title", `%${term.replace(/[%_\\]/g, "\\$&")}%`);
      if (filters.object) query = query.eq("object_id", filters.object);
      if (filters.assignee) query = query.eq("assignee_id", filters.assignee);
      if (filters.priority) query = query.eq("priority", filters.priority);
      if (filters.department) query = query.eq("department_id", filters.department);
      if (tab !== "done") query = query.order("created_at", { ascending: false });
      const { data, count, error } = await query.order("id").range(page * 50, page * 50 + 49);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as PlannerTask[], count: count ?? 0 };
    },
  });
  const kpi = useQuery({
    queryKey: ["task-hub-kpi", currentOrgId, userId, today],
    enabled: !!currentOrgId && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!currentOrgId || !userId) return [0, 0, 0, 0];
      const base = () => supabase.from("planner_tasks").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId);
      const counts = await Promise.all([
        applyTabFilter(base(), "all", userId, today),
        applyTabFilter(base(), "done", userId, today).gte("completed_at", subDays(new Date(), 30).toISOString()),
        applyTabFilter(base(), "overdue", userId, today),
        applyTabFilter(base(), "control", userId, today),
      ]);
      return counts.map(result => { if (result.error) throw result.error; return result.count ?? 0; });
    },
  });
  const objects = useQuery({
    queryKey: ["task-hub-objects", currentOrgId], enabled: !!currentOrgId, staleTime: 60_000,
    queryFn: async () => {
      if (!currentOrgId) return [];
      const rows: { id: string; name: string }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("request_objects").select("id,name").eq("organization_id", currentOrgId).order("name").order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return rows;
      }
    },
  });
  useEffect(() => {
    if (!currentOrgId) return;
    const channel = supabase.channel(`task-hub-${currentOrgId}`).on("postgres_changes", { event: "*", schema: "public", table: "planner_tasks", filter: `organization_id=eq.${currentOrgId}` }, () => invalidatePlannerTaskQueries(qc)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentOrgId, qc]);
  return { orgId: currentOrgId, list, kpi, objects };
}