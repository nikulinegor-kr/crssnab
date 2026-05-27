import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";

export interface PlannerStage {
  id: string;
  organization_id: string;
  object_id: string | null;
  name: string;
  description: string | null;
  position: number;
  start_date: string | null;
  due_date: string | null;
  color: string;
  status: "planned" | "active" | "done" | "blocked";
  created_at: string;
  updated_at: string;
}

export const STAGE_COLORS = ["blue", "violet", "green", "orange", "rose", "amber", "cyan"];

export const usePlannerStages = (objectId?: string | null) => {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-stages", currentOrgId, objectId ?? "all"],
    queryFn: async (): Promise<PlannerStage[]> => {
      if (!currentOrgId) return [];
      let q = supabase.from("planner_stages").select("*").eq("organization_id", currentOrgId);
      if (objectId) q = q.eq("object_id", objectId);
      const { data, error } = await q.order("position");
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!currentOrgId,
  });
};

export const useUpsertPlannerStage = () => {
  const { currentOrgId } = useCurrentOrganization();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<PlannerStage> & { name: string }) => {
      if (!currentOrgId) throw new Error("Нет организации");
      const payload: any = { organization_id: currentOrgId, ...input };
      if (input.id) {
        const { error } = await supabase.from("planner_stages").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planner_stages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planner-stages"] });
      toast({ title: "Этап сохранён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const useDeletePlannerStage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planner_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planner-stages"] });
      toast({ title: "Этап удалён" });
    },
  });
};
