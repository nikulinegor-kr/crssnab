import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

interface OrgBranding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  name: string;
}

export const useOrgBranding = () => {
  const { currentOrgId } = useCurrentOrganization();

  const { data, isLoading } = useQuery({
    queryKey: ["org-branding", currentOrgId],
    queryFn: async (): Promise<OrgBranding | null> => {
      if (!currentOrgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("name, logo_url, primary_color, secondary_color")
        .eq("id", currentOrgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
    staleTime: 1000 * 60 * 10,
  });

  return {
    logoUrl: data?.logo_url || null,
    primaryColor: data?.primary_color || null,
    secondaryColor: data?.secondary_color || null,
    orgName: data?.name || "",
    isLoading,
  };
};
