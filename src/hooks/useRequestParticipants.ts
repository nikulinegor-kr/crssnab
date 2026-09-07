import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPersonName } from "@/lib/personName";

export interface RequestParticipant {
  id: string;
  name: string;
  /** Имя в едином формате «Фамилия И.О.» — для отображения. */
  label: string;
}

/**
 * Справочник участников заявок. Заявители и исполнители — разные списки,
 * смешивать их нельзя ни в формах, ни в фильтрах.
 */
export const useRequestParticipants = (
  type: "applicant" | "executor",
  organizationId?: string | null,
  enabled = true
) =>
  useQuery({
    queryKey: ["request-participants", organizationId, type],
    enabled: !!organizationId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RequestParticipant[]> => {
      const { data, error } = await supabase
        .from("request_participants")
        .select("id, name")
        .eq("organization_id", organizationId!)
        .eq("participant_type", type)
        .order("name");
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        label: formatPersonName(p.name as string) || (p.name as string),
      }));
    },
  });
