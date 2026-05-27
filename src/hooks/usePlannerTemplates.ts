import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";
import type { ChecklistItem, PlannerTaskPriority } from "./usePlannerTasks";

export interface PlannerTaskTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  priority: PlannerTaskPriority;
  checklist: ChecklistItem[];
  estimated_hours: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export const usePlannerTemplates = () => {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-templates", currentOrgId],
    queryFn: async (): Promise<PlannerTaskTemplate[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("planner_task_templates")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!currentOrgId,
  });
};

export const useUpsertPlannerTemplate = () => {
  const { currentOrgId } = useCurrentOrganization();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<PlannerTaskTemplate> & { name: string }) => {
      if (!currentOrgId) throw new Error("Нет организации");
      const payload: any = { organization_id: currentOrgId, ...input };
      if (input.id) {
        const { error } = await supabase.from("planner_task_templates").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planner_task_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planner-templates"] });
      toast({ title: "Шаблон сохранён" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const useDeletePlannerTemplate = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planner_task_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planner-templates"] });
      toast({ title: "Шаблон удалён" });
    },
  });
};
