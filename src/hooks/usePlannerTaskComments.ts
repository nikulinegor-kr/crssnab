import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";

export interface PlannerComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface PlannerActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

export const usePlannerTaskComments = (taskId: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planner-comments", taskId],
    queryFn: async (): Promise<PlannerComment[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("planner_task_comments")
        .select("id, task_id, user_id, content, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (!taskId) return;
    const ch = supabase
      .channel(`planner-comments-${taskId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "planner_task_comments", filter: `task_id=eq.${taskId}` },
        () => queryClient.invalidateQueries({ queryKey: ["planner-comments", taskId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, queryClient]);

  return query;
};

export const useAddPlannerComment = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentOrgId) throw new Error("Не авторизован");
      const { error } = await supabase.from("planner_task_comments").insert({
        task_id: taskId,
        organization_id: currentOrgId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["planner-comments", vars.taskId] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const usePlannerTaskActivity = (taskId: string | null) => {
  return useQuery({
    queryKey: ["planner-activity", taskId],
    queryFn: async (): Promise<PlannerActivity[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("planner_task_activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!taskId,
  });
};
