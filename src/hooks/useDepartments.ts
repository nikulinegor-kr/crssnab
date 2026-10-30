import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export function useDepartments() {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["departments", currentOrgId],
    enabled: !!currentOrgId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!currentOrgId) return [];
      const rows: { id: string; name: string; is_active: boolean }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("departments").select("id,name,is_active").eq("organization_id", currentOrgId).order("name").order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return rows;
      }
    },
  });
}