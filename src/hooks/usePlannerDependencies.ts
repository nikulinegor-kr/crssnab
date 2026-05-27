import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";

export interface PlannerDependency {
  id: string;
  task_id: string;
  blocked_by_task_id: string;
  dep_type: string;
}

export const usePlannerDependencies = (taskId: string | null) => {
  return useQuery({
    queryKey: ["planner-deps", taskId],
    queryFn: async (): Promise<PlannerDependency[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("planner_task_dependencies")
        .select("*")
        .eq("task_id", taskId);
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!taskId,
  });
};

export const useAddPlannerDependency = () => {
  const { currentOrgId } = useCurrentOrganization();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ taskId, blockedById }: { taskId: string; blockedById: string }) => {
      if (!currentOrgId) throw new Error("Нет организации");
      if (taskId === blockedById) throw new Error("Нельзя зависеть от самой себя");
      const { error } = await supabase.from("planner_task_dependencies").insert({
        organization_id: currentOrgId,
        task_id: taskId,
        blocked_by_task_id: blockedById,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["planner-deps", v.taskId] });
      toast({ title: "Зависимость добавлена" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const useRemovePlannerDependency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planner_task_dependencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-deps"] }),
  });
};
