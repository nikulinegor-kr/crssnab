import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export interface OrgMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  position: string | null;
  role: string | null;
}

export const useOrgMembers = () => {
  const { currentOrgId } = useCurrentOrganization();

  return useQuery({
    queryKey: ["org-members", currentOrgId],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!currentOrgId) return [];
      const { data: links, error } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", currentOrgId);
      if (error) throw error;
      const userIds = (links ?? []).map((l) => l.user_id);
      if (!userIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, position")
        .in("id", userIds);

      return (links ?? []).map((l) => {
        const p = profiles?.find((x) => x.id === l.user_id);
        return {
          user_id: l.user_id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          position: p?.position ?? null,
          role: l.role ?? null,
        };
      }).sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
  });
};

export const initialsOf = (m: { full_name?: string | null; email?: string | null }) => {
  const src = m.full_name?.trim() || m.email?.trim() || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};
