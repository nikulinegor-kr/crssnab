import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

/** Shared cached auth user id — avoids repeated auth.getUser() round trips. */
export const useAuthUserId = () =>
  useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

export interface OrgMembershipRow {
  role: string | null;
  is_active: boolean | null;
  planner_access: boolean | null;
  can_manage_tasks: boolean | null;
}

/**
 * Single source of truth for the current user's membership row.
 * All consumers share one queryKey, so parallel hooks dedupe into one request.
 */
export const useOrgMembership = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { data: userId, isLoading: authLoading } = useAuthUserId();

  const query = useQuery({
    queryKey: ["org-membership", currentOrgId, userId],
    queryFn: async (): Promise<OrgMembershipRow | null> => {
      if (!currentOrgId || !userId) return null;
      const { data, error } = await supabase
        .from("user_organizations")
        .select("role, is_active, planner_access, can_manage_tasks")
        .eq("organization_id", currentOrgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as OrgMembershipRow) ?? null;
    },
    enabled: !!currentOrgId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    loading: authLoading || (!!currentOrgId && !!userId && query.isLoading),
  };
};
