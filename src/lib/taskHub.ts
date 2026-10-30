import type { PlannerTaskStatus } from "./plannerStatuses";

export type TaskTab = "all" | "mine" | "created" | "control" | "overdue" | "done" | "recurring";
export const TASK_TABS: { id: TaskTab; label: string; empty: string }[] = [
  { id: "all", label: "Все", empty: "Активных задач нет" },
  { id: "mine", label: "Мои", empty: "Назначенных вам задач нет" },
  { id: "created", label: "Поставленные мной", empty: "Поставленных вами задач нет" },
  { id: "control", label: "На контроле", empty: "Задач на вашей приёмке нет" },
  { id: "overdue", label: "Просроченные", empty: "Просроченных задач нет" },
  { id: "done", label: "Завершённые", empty: "Завершённых задач нет" },
  { id: "recurring", label: "Повторяющиеся", empty: "Повторяющихся задач нет" },
];

interface FilterQuery {
  is(column: string, value: null): FilterQuery;
  eq(column: string, value: string | boolean): FilterQuery;
  neq(column: string, value: string): FilterQuery;
  or(filter: string): FilterQuery;
  lt(column: string, value: string): FilterQuery;
  not(column: string, operator: string, value: null): FilterQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): FilterQuery;
}

export function applyTabFilter<Q>(query: Q, tab: TaskTab, userId: string, todayISO: string): Q {
  let filtered = (query as unknown as FilterQuery).is("archived_at", null).eq("hidden_auto", false);
  if (tab === "done") return filtered.eq("status", "done").order("completed_at", { ascending: false, nullsFirst: false }) as unknown as Q;
  filtered = filtered.neq("status", "done");
  switch (tab) {
    case "mine": filtered = filtered.or(`assignee_id.eq.${userId},co_assignee_ids.cs.{${userId}}`); break;
    case "created": filtered = filtered.eq("created_by", userId).or(`assignee_id.is.null,assignee_id.neq.${userId}`); break;
    case "control": filtered = filtered.eq("reviewer_id", userId).eq("status", "review"); break;
    case "overdue": filtered = filtered.lt("due_date", todayISO); break;
    case "recurring": filtered = filtered.not("recurrence", "is", null); break;
  }
  return filtered as unknown as Q;
}

export interface TransitionTask {
  status: PlannerTaskStatus;
  assignee_id: string | null;
  co_assignee_ids: string[];
  reviewer_id: string | null;
  created_by: string | null;
  requires_acceptance: boolean;
}
export interface TaskTransition {
  status: PlannerTaskStatus;
  label: string;
  dialog?: "waiting" | "rework";
}

export function canReviewTask(task: TransitionTask, userId: string | null, isOrgAdmin: boolean): boolean {
  return !!userId && (isOrgAdmin || task.created_by === userId || task.reviewer_id === userId);
}

export function getAvailableTransitions(task: TransitionTask, userId: string | null, isOrgAdmin: boolean): TaskTransition[] {
  if (!userId) return [];
  const canExecute = isOrgAdmin || task.created_by === userId || task.assignee_id === userId || task.co_assignee_ids?.includes(userId);
  const actions: TaskTransition[] = [];
  if (canExecute) {
    if (task.status === "backlog" || task.status === "todo") actions.push({ status: "accepted", label: "Принять" });
    if (task.status === "accepted") actions.push({ status: "in_progress", label: "Начать" });
    if (task.status === "in_progress" || task.status === "rework") {
      actions.push(task.requires_acceptance
        ? { status: "review", label: "Передать на проверку" }
        : { status: "done", label: "Завершить" });
    }
    if (["backlog", "todo", "accepted", "in_progress", "rework"].includes(task.status)) {
      actions.push({ status: "waiting", label: "Поставить на ожидание", dialog: "waiting" });
    }
    if (task.status === "waiting") actions.push({ status: "in_progress", label: "Возобновить" });
  }
  if (task.status === "review" && canReviewTask(task, userId, isOrgAdmin)) {
    actions.push({ status: "done", label: "Принять результат" }, { status: "rework", label: "На доработку", dialog: "rework" });
  }
  return actions;
}