import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import type { PlannerTask } from "./usePlannerTasks";

/**
 * Unified read-only source of ALL planner tasks of the organization
 * (both auto CRM tasks and personal/manual ones).
 * Used by the deadline-based views so that every view shares one dataset.
 */
export const useAllPlannerTasks = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planner-tasks-all", currentOrgId],
    queryFn: async (): Promise<PlannerTask[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("planner_tasks")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as PlannerTask[];
    },
    enabled: !!currentOrgId,
  });

  useEffect(() => {
    if (!currentOrgId) return;
    const ch = supabase
      .channel(`planner-tasks-all-${currentOrgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planner_tasks", filter: `organization_id=eq.${currentOrgId}` },
        () => queryClient.invalidateQueries({ queryKey: ["planner-tasks-all"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentOrgId, queryClient]);

  return query;
};
