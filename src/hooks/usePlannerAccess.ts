import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

/**
 * Planner rights of the current user, independent from having a CRM account:
 * - hasPlannerAccess: appears in the planner and can receive tasks
 * - canManageTasks: can create tasks, change status and see other people's tasks
 */
export const usePlannerAccess = () => {
  const { currentOrgId } = useCurrentOrganization();

  const query = useQuery({
    queryKey: ["planner-access", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return null;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("user_organizations")
        .select("role, is_active, planner_access, can_manage_tasks")
        .eq("organization_id", currentOrgId)
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
  });

  const row = query.data;
  const isAdmin = row?.role === "owner" || row?.role === "admin";
  const active = row?.is_active !== false && !!row;
  const hasPlannerAccess = active && (isAdmin || row?.planner_access !== false);
  const canManageTasks =
    active && (isAdmin || (row?.planner_access !== false && row?.can_manage_tasks !== false));

  return { loading: query.isLoading, isAdmin, hasPlannerAccess, canManageTasks };
};
