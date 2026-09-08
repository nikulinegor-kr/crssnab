import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export interface RequestWithoutTask {
  id: string;
  description: string | null;
  request_number: string | null;
  status: string | null;
  object_id: string | null;
  delivery_date: string | null;
  created_at: string;
}

/** Statuses that mean the request is finished — such requests need no task. */
const CLOSED_STATUSES = ["Доставлено", "Выполнено"];

/**
 * Requests of the organization that have no planner task linked yet
 * (reverse lookup over planner_tasks.request_id).
 */
export const useRequestsWithoutTasks = (limit = 60) => {
  const { currentOrgId } = useCurrentOrganization();

  return useQuery({
    queryKey: ["planner-requests-without-tasks", currentOrgId, limit],
    queryFn: async (): Promise<RequestWithoutTask[]> => {
      if (!currentOrgId) return [];

      const { data: linked, error: linkErr } = await supabase
        .from("planner_tasks")
        .select("request_id")
        .eq("organization_id", currentOrgId)
        .not("request_id", "is", null)
        .limit(5000);
      if (linkErr) throw linkErr;
      const linkedIds = new Set((linked ?? []).map((r: any) => r.request_id as string));

      const { data, error } = await supabase
        .from("requests")
        .select("id, description, request_number, status, object_id, delivery_date, created_at")
        .eq("organization_id", currentOrgId)
        .not("status", "in", `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      return ((data ?? []) as any[])
        .filter((r) => !linkedIds.has(r.id))
        .slice(0, limit) as RequestWithoutTask[];
    },
    enabled: !!currentOrgId,
    staleTime: 60_000,
  });
};
