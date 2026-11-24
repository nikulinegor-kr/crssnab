import { RECENT_ARRIVAL_DAYS, isRecentArrival } from "./requestArrivals";

const REQUEST_PHASES = [
  { key: "unworked", name: "Не отработано", statuses: ["Новая заявка", "На согласовании"], accent: "bg-muted-foreground" },
  { key: "accounting", name: "Счёт в бухгалтерии", statuses: ["Счёт в Бухгалтерии", "Счёт в бухгалтерии"], accent: "bg-warning" },
  { key: "working", name: "В работе", statuses: ["КП", "Счёт", "В работе"], accent: "bg-info" },
  { key: "ready", name: "Готов к отгрузке", statuses: ["Готов к отгрузке"], accent: "bg-warning" },
  { key: "transit", name: "В пути", statuses: ["В пути", "Доставлено в ТК"], accent: "bg-primary" },
] as const;

export const DEFAULT_COLLAPSED_REQUEST_PHASES: ReadonlySet<string> = new Set(["recent-arrivals", "delivered", "completed-tasks"]);

type PhaseRequest = { status?: string | null; actual_arrival_date?: string | null; delivery_date?: string | null; updated_at?: string | null };

export function groupRequestsByPhase<T extends PhaseRequest>(rows: T[]) {
  const buckets = new Map<string, T[]>();
  const statusPhases = new Map<string, string>();
  for (const phase of REQUEST_PHASES) {
    for (const status of phase.statuses) statusPhases.set(status, phase.key);
  }
  for (const row of rows) {
    const phase = row.status === "Выполнено" ? "completed-tasks"
      : row.status === "Доставлено" ? isRecentArrival(row) ? "recent-arrivals" : "delivered"
      : statusPhases.get(row.status ?? "") ?? "other";
    const items = buckets.get(phase);
    if (items) items.push(row);
    else buckets.set(phase, [row]);
  }
  return [
    ...REQUEST_PHASES.slice(0, 2),
    { key: "other", name: "Другие статусы", accent: "bg-border" },
    ...REQUEST_PHASES.slice(2),
    { key: "recent-arrivals", name: `Приходы за ${RECENT_ARRIVAL_DAYS} дней`, accent: "bg-success" },
    { key: "delivered", name: "Доставлено", accent: "bg-success" },
    { key: "completed-tasks", name: "Задачи", accent: "bg-success" },
  ].flatMap(({ key, name, accent }) => {
    const items = buckets.get(key);
    return items?.length ? [{ key, name, accent, items }] : [];
  });
}
