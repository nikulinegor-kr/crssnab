import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";
import { usePlannerScope } from "@/contexts/PlannerScopeContext";

export type PlannerTaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type PlannerTaskPriority = "low" | "medium" | "high" | "urgent" | "critical";
export type PlannerTaskSource = "manual" | "auto_rule" | "crm_request";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PlannerAttachment {
  name: string;
  url: string;
  path?: string;
  size?: number;
  mime?: string;
}

export interface PlannerRecurrence {
  freq: "daily" | "weekly" | "monthly";
  interval?: number;
  until?: string | null;
}

export interface PlannerTask {
  id: string;
  organization_id: string;
  object_id: string | null;
  stage_id: string | null;
  request_id: string | null;
  equipment_id: string | null;
  equipment_ids: string[];
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: PlannerTaskStatus;
  priority: PlannerTaskPriority;
  assignee_id: string | null;
  created_by: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  tags: string[];
  checklist: ChecklistItem[];
  attachments: PlannerAttachment[];
  is_private: boolean;
  recurrence: PlannerRecurrence | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  source?: PlannerTaskSource | null;
  source_rule?: string | null;
  due_time?: string | null;
  created_at: string;
  updated_at: string;
}

export const PLANNER_COLUMNS: { id: PlannerTaskStatus; title: string }[] = [
  { id: "backlog", title: "Новые задачи" },
  { id: "todo", title: "К выполнению" },
  { id: "in_progress", title: "В работе" },
  { id: "review", title: "На проверке" },
  { id: "done", title: "Выполнено" },
];

export const PRIORITY_META: Record<
  PlannerTaskPriority,
  { label: string; className: string; dot: string }
> = {
  low: { label: "Низкий", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  medium: { label: "Средний", className: "bg-primary/10 text-primary", dot: "bg-primary" },
  high: { label: "Высокий", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  urgent: { label: "Срочно", className: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  critical: { label: "Критический", className: "bg-red-500/15 text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

export const usePlannerTasks = () => {
  const { currentOrgId } = useCurrentOrganization();
  const scope = usePlannerScope();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planner-tasks", currentOrgId, scope],
    queryFn: async (): Promise<PlannerTask[]> => {
      if (!currentOrgId) return [];
      let q = supabase
        .from("planner_tasks")
        .select("*")
        .eq("organization_id", currentOrgId);
      if (scope === "auto") {
        q = q.eq("source", "auto_rule");
      } else {
        q = q.or("source.is.null,source.eq.manual");
      }
      const { data, error } = await q
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlannerTask[];
    },
    enabled: !!currentOrgId,
  });

  // Realtime
  useEffect(() => {
    if (!currentOrgId) return;
    const ch = supabase
      .channel(`planner-tasks-rt-${scope}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planner_tasks", filter: `organization_id=eq.${currentOrgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["planner-tasks", currentOrgId, scope] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentOrgId, queryClient, scope]);

  return query;
};

export const useCreatePlannerTask = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<PlannerTask> & { title: string }) => {
      if (!currentOrgId) throw new Error("Нет организации");
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        organization_id: currentOrgId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "backlog",
        priority: input.priority ?? "medium",
        assignee_id: input.assignee_id ?? null,
        object_id: input.object_id ?? null,
        stage_id: input.stage_id ?? null,
        request_id: input.request_id ?? null,
        equipment_id: input.equipment_id ?? null,
        equipment_ids: (input as any).equipment_ids ?? [],
        start_date: input.start_date ?? null,
        due_date: input.due_date ?? null,
        tags: input.tags ?? [],
        checklist: input.checklist ?? [],
        attachments: input.attachments ?? [],
        is_private: input.is_private ?? false,
        recurrence: input.recurrence ?? null,
        estimated_hours: input.estimated_hours ?? null,
        due_time: (input as any).due_time ?? null,
        source: (input as any).source ?? "manual",
        source_rule: (input as any).source_rule ?? null,
        position: input.position ?? Date.now() % 1000000,
        created_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("planner_tasks")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-tasks"] });
      toast({ title: "Задача создана" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const useUpdatePlannerTask = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlannerTask> }) => {
      const update: any = { ...patch };
      if (patch.status === "done" && !patch.completed_at) {
        update.completed_at = new Date().toISOString();
      }
      if (patch.status && patch.status !== "done") {
        update.completed_at = null;
      }
      const { error } = await supabase.from("planner_tasks").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-tasks"] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};

export const useDeletePlannerTask = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planner_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-tasks"] });
      toast({ title: "Задача удалена" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });
};
