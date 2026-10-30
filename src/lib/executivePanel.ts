import { differenceInCalendarDays, differenceInDays, startOfDay } from "date-fns";
import { PLANNER_STATUS_LABELS, type PlannerTaskStatus } from "./plannerStatuses";

export type ExecAttentionItem = {
  id: string;
  kind: "task" | "request";
  title: string;
  reference?: string;
  objectName: string | null;
  assigneeName?: string | null;
  priority: string | null;
  days: number;
};
export type ExecObjectLoad = { id: string; name: string; requests: number; amount: number; overdueTasks: number };
export type ExecEvent = { id: string; kind: "task" | "request"; entityId: string; description: string; reference: string; actor: string; createdAt: string };

export const overdueDays = (date: string, today: Date) => Math.max(0, differenceInCalendarDays(startOfDay(today), startOfDay(new Date(date))));
export const sortAttention = (items: ExecAttentionItem[], limit = 3) => [...items].sort((a, b) =>
  Number(["critical", "urgent"].includes(b.priority ?? "")) - Number(["critical", "urgent"].includes(a.priority ?? "")) || b.days - a.days
).slice(0, limit);
export const sortObjects = (items: ExecObjectLoad[]) => items.filter(i => i.requests > 0 || i.overdueTasks > 0)
  .sort((a, b) => b.overdueTasks - a.overdueTasks || b.amount - a.amount).slice(0, 6);
export const sortEvents = (items: ExecEvent[]) => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 6);
export const formatExecFullAmount = (value: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ")} ₽`;
export const formatExecAmount = (value: number) => value >= 1_000_000
  ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value / 1_000_000)} млн ₽`
  : value >= 1000 ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1000)} тыс. ₽` : formatExecFullAmount(value);

export const EXEC_LINKS = {
  newRequests: "/requests?status=Новая заявка",
  openRequests: "/requests?open=1",
  staleRequests: "/requests?filter=stale",
  overdueDeliveries: "/requests?filter=overdueDelivery",
  overdueTasks: "/tasks?tab=overdue",
  activeTasks: "/tasks?tab=all",
} as const;
export const execRequestLink = (id: string) => `/requests?request=${encodeURIComponent(id)}`;
export const execObjectRequestsLink = (id: string) => `/requests?object=${encodeURIComponent(id)}&open=1`;
export const execObjectTasksLink = (id: string) => `/tasks?tab=overdue&object=${encodeURIComponent(id)}`;
export type ExecAttentionGroup = { key: "overdueTasks" | "overdueDeliveries" | "staleRequests"; title: string; count: number; items: ExecAttentionItem[]; overdue: boolean };
export const isOldNewRequest = (r: { status: string; created_at: string | null }, today: Date) =>
  r.status === "Новая заявка" && !!r.created_at && differenceInDays(today, new Date(r.created_at)) > 2;

export const REQUEST_URL_FILTER_KEYS = ["status", "priority", "new", "filter", "payment_status", "contractor", "object", "open", "mine"] as const;
export const requestUrlFilterKey = (params: URLSearchParams) => REQUEST_URL_FILTER_KEYS.filter(k => params.has(k)).map(k => `${k}=${params.get(k)}`).join("&");
export const requestUrlFilterDescription = (params: URLSearchParams, objectName?: string) => {
  const labels: string[] = [];
  if (params.get("status")) labels.push(params.get("status") ?? "");
  if (params.get("mine") === "1") labels.push("мои заявки");
  if (params.get("open") === "1") labels.push("заявки в работе");
  if (params.get("object")) labels.push(objectName || "выбранный объект");
  const filterNames: Record<string, string> = { stale: "без движения", overdueDelivery: "просроченные поставки", overdue: "просроченные заявки", unpaid: "ждут оплаты", paid: "оплаченные", invoiced: "счета в бухгалтерии", deliveryToday: "приходы сегодня", overdueShipment: "просроченные отгрузки", deliveredLast7Days: "приходы за 7 дней", upcomingNext7Days: "приходы на 7 дней" };
  const special = params.get("filter") || params.get("payment_status");
  if (special) labels.push(filterNames[special] || special);
  if (params.get("priority")) labels.push(params.get("priority") ?? "");
  if (params.get("contractor")) labels.push(params.get("contractor") ?? "");
  if (params.get("new")) labels.push("текущий год");
  return labels.join(" · ");
};

export function isExecEventVisible(event: { action: string; description: string | null }) {
  return !event.action.startsWith("reminder_") && !event.action.includes("reminder") && Boolean(event.description?.trim());
}
export function describeExecEvent(event: { action: string; description: string | null; old_value?: string | null; new_value?: string | null }, kind: "task" | "request", names = new Map<string, string>()) {
  const value = (v: string | null | undefined) => kind === "task" ? PLANNER_STATUS_LABELS[v as PlannerTaskStatus] || v || "—" : v || "—";
  if (["status_change", "status_changed"].includes(event.action)) return `Статус: ${value(event.old_value)} → ${value(event.new_value)}`;
  if (event.action === "created") return kind === "task" ? "Создана задача" : "Создана заявка";
  if (["assigned", "executor_assigned", "executor_changed"].includes(event.action)) return `Назначен ${names.get(event.new_value || "") || (event.new_value && !/^[0-9a-f-]{36}$/i.test(event.new_value) ? event.new_value : "ответственный")}`;
  const labels: Record<string, string> = { renamed: "Изменено название", executor_removed: "Исполнитель снят", accepted_no_issues: "Принято без замечаний", received_confirmed: "Приход подтверждён", document_added: "Добавлен документ", invoice_added: "Добавлен счёт", invoice_marked_paid: "Счёт оплачен", invoice_sent_to_payment: "Счёт передан на оплату", photo_added: "Добавлено фото", discrepancy_found: "Обнаружено расхождение", discrepancy_description: "Уточнено расхождение", discrepancy_type_selected: "Указан тип расхождения", priority_changed: "Изменён приоритет" };
  return labels[event.action] || event.description?.trim() || "Изменено";
}
