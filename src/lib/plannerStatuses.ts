export type PlannerTaskStatus = "backlog" | "todo" | "accepted" | "in_progress" | "waiting" | "review" | "rework" | "done";

export const PLANNER_STATUS_LABELS: Record<PlannerTaskStatus, string> = {
  backlog: "Новая",
  todo: "Новая",
  accepted: "Принята",
  in_progress: "В работе",
  waiting: "Ожидает",
  review: "На проверке",
  rework: "На доработке",
  done: "Завершена",
};

/** Preserve the existing four board columns without changing stored statuses. */
export const normalizeStatus = (status: PlannerTaskStatus): PlannerTaskStatus => {
  if (status === "todo" || status === "accepted") return "backlog";
  if (status === "waiting" || status === "rework") return "in_progress";
  return status;
};