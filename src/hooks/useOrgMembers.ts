import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export interface OrgMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  position: string | null;
  role: string | null;
  is_active: boolean;
  planner_access: boolean;
  can_manage_tasks: boolean;
  deactivated_at: string | null;
}

interface UseOrgMembersOptions {
  /** Include deactivated (dismissed) employees — for historical display only. */
  includeInactive?: boolean;
}

export const useOrgMembers = (options: UseOrgMembersOptions = {}) => {
  const { includeInactive = false } = options;
  const { currentOrgId } = useCurrentOrganization();

  return useQuery({
    queryKey: ["org-members", currentOrgId, includeInactive],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!currentOrgId) return [];
      const { data: links, error } = await supabase
        .from("user_organizations")
        .select("user_id, role, is_active, planner_access, can_manage_tasks, deactivated_at")
        .eq("organization_id", currentOrgId);
      if (error) throw error;

      const rows = (links ?? []).filter((l) => includeInactive || l.is_active !== false);
      const userIds = rows.map((l) => l.user_id);
      if (!userIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, position")
        .in("id", userIds);

      return rows
        .map((l) => {
          const p = profiles?.find((x) => x.id === l.user_id);
          const isAdmin = l.role === "owner" || l.role === "admin";
          return {
            user_id: l.user_id,
            full_name: p?.full_name ?? null,
            email: p?.email ?? null,
            position: p?.position ?? null,
            role: l.role ?? null,
            is_active: l.is_active !== false,
            planner_access: isAdmin || l.planner_access === true,
            can_manage_tasks: isAdmin || l.can_manage_tasks === true,
            deactivated_at: l.deactivated_at ?? null,
          };
        })
        .sort((a, b) =>
          (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "")
        );
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Employees who may be involved in planner work:
 * active + planner access enabled. Use for every assignee/employee picker.
 */
export const usePlannerMembers = () => {
  const query = useOrgMembers();
  return {
    ...query,
    data: (query.data ?? []).filter((m) => m.is_active && m.planner_access),
  };
};

export const initialsOf = (m: { full_name?: string | null; email?: string | null }) => {
  const src = m.full_name?.trim() || m.email?.trim() || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};
