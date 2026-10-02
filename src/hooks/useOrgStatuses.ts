import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { STATUSES, registerCustomStatusColors } from "@/hooks/useRequestsFilters";

/** Статусы организации из настроек (порядок из базы) + стандартные, которых там нет. */
export const useOrgStatuses = (): string[] => {
  const { currentOrgId } = useCurrentOrganization();
  const { data } = useQuery({
    queryKey: ["request-statuses-list", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_statuses")
        .select("name, color, order")
        .eq("organization_id", currentOrgId!)
        .order("order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.length) return STATUSES;
  registerCustomStatusColors(data.map((s: any) => ({ name: String(s.name).trim(), color: s.color })));
  const names = data.map((s: any) => String(s.name).trim()).filter(Boolean);
  const set = new Set(names);
  return [...names, ...STATUSES.filter((s) => !set.has(s))];
};
