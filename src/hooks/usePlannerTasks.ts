import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";
import { usePlannerScope } from "@/contexts/PlannerScopeContext";
import { usePlannerAccess } from "./usePlannerAccess";

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
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const PLANNER_COLUMNS: { id: PlannerTaskStatus; title: string }[] = [
  { id: "backlog", title: "Новые" },
  { id: "in_progress", title: "В работе" },
  { id: "review", title: "На проверке" },
  { id: "done", title: "Выполнено" },
];

/** Legacy "todo" tasks are shown in the "Новые" column. */
export const normalizeStatus = (s: PlannerTaskStatus): PlannerTaskStatus =>
  s === "todo" ? "backlog" : s;

export const PRIORITY_META: Record<
  PlannerTaskPriority,
  { label: string; className: string; dot: string }
> = {
  low: { label: "Планово", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  medium: { label: "Планово", className: "bg-primary/10 text-primary", dot: "bg-primary" },
  high: { label: "Приоритетно", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  urgent: { label: "Аварийно", className: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  critical: { label: "Аварийно", className: "bg-red-500/15 text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

/** Priorities offered when creating/editing a task (CRM standard). */
export const PRIORITY_CHOICES: PlannerTaskPriority[] = ["urgent", "high", "medium"];


/**
 * Unified planner task source: ALL tasks of the organization (auto + manual).
 * Views (today / week / all / mine / employees) only filter this single dataset.
 * Employees without admin rights only get their own tasks.
 */
export const usePlannerTasks = () => {
  const { currentOrgId } = useCurrentOrganization();
  const scope = usePlannerScope();
  const { canManageTasks } = usePlannerAccess();
  const { data: currentUserId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 60_000,
  });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planner-tasks", currentOrgId, canManageTasks, currentUserId],
    queryFn: async (): Promise<PlannerTask[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await (supabase.from("planner_tasks") as any)
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("hidden_auto", false)
        .is("archived_at", null)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;
      const all = (data ?? []) as unknown as PlannerTask[];
      if (canManageTasks || !currentUserId) return all;
      return all.filter(
        (t) => t.assignee_id === currentUserId || t.created_by === currentUserId
      );
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
          queryClient.invalidateQueries({ queryKey: ["planner-tasks"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentOrgId, queryClient, scope]);

  return query;
};

/** Archived tasks (hidden from all regular views, restorable). */
export const useArchivedPlannerTasks = () => {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-tasks-archived", currentOrgId],
    queryFn: async (): Promise<PlannerTask[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await (supabase.from("planner_tasks") as any)
        .select("*")
        .eq("organization_id", currentOrgId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as PlannerTask[];
    },
    enabled: !!currentOrgId,
  });
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
