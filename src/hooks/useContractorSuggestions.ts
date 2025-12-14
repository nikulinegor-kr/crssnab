import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

export const useContractorSuggestions = () => {
  const { currentOrgId } = useCurrentOrganization();

  const { data: recentContractors = [] } = useQuery({
    queryKey: ["recent-contractors", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];

      // Get unique contractors from recent requests
      const { data, error } = await supabase
        .from("requests")
        .select("contractor")
        .eq("organization_id", currentOrgId)
        .not("contractor", "is", null)
        .not("contractor", "eq", "")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Extract unique contractor names
      const uniqueContractors = [...new Set(
        data
          .map((r) => r.contractor)
          .filter((c): c is string => !!c && c.trim().length > 0)
      )].slice(0, 20);

      return uniqueContractors;
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: recentTransportCompanies = [] } = useQuery({
    queryKey: ["recent-transport-companies", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];

      const { data, error } = await supabase
        .from("requests")
        .select("transport_company")
        .eq("organization_id", currentOrgId)
        .not("transport_company", "is", null)
        .not("transport_company", "eq", "")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const uniqueCompanies = [...new Set(
        data
          .map((r) => r.transport_company)
          .filter((c): c is string => !!c && c.trim().length > 0)
      )].slice(0, 20);

      return uniqueCompanies;
    },
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
  });

  return { recentContractors, recentTransportCompanies };
};
