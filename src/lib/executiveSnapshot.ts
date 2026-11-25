import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { CLOSED_REQUEST_STATUSES, isOverdueDelivery } from "./requestStaleness";

export type ExecRequestRow = {
  id: string; request_number: string; description: string; comments: string | null; status: string; priority: string | null;
  executor: string | null; object_id: string | null; object?: { name: string } | null;
  amount: number | null; amount_2: number | null; amount_3: number | null;
  payment_percent: number | null; payment_percentage: number | null;
  planned_delivery_date: string | null; actual_arrival_date: string | null; delivery_date: string | null;
  transport_company: string | null; created_at: string | null; updated_at: string | null;
};
export type QueueTag = "payment" | "delivery" | "tasks" | "overdue";
export type QueueFilter = "all" | QueueTag;
export type QueueItem = { key: string; kind: "request" | "task"; id: string; title: string; comment: string | null; reference: string; objectName: string | null; owner: string | null; date: string | null; reason: string; tags: QueueTag[]; amountLeft: number | null };

/** Sum of all three invoices; null only when none is known. */
export function invoiceTotal(r: Pick<ExecRequestRow, "amount" | "amount_2" | "amount_3">): number | null {
  const vals = [r.amount, r.amount_2, r.amount_3].filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}
/** Payment remainder from the actual payment fact only; null = unknown (never treated as zero debt). */
export function paymentLeft(r: Pick<ExecRequestRow, "amount" | "amount_2" | "amount_3" | "payment_percent">): number | null {
  const total = invoiceTotal(r);
  if (total === null || total <= 0 || r.payment_percent === null || r.payment_percent === undefined) return null;
  const fact = Math.min(100, Math.max(0, Number(r.payment_percent)));
  return Math.round(total * (100 - fact)) / 100;
}
export const isAwaitingPayment = (r: ExecRequestRow) => { const left = paymentLeft(r); return left !== null && left > 0; };
export const isUnknownPayment = (r: ExecRequestRow) => (invoiceTotal(r) ?? 0) > 0 && (r.payment_percent === null || r.payment_percent === undefined);
const arrival = (r: ExecRequestRow) => r.planned_delivery_date || r.delivery_date;
export function isUpcomingDelivery(r: ExecRequestRow, today: Date, days = 7) {
  const d = arrival(r); if (!d || r.actual_arrival_date || CLOSED_REQUEST_STATUSES.includes(r.status)) return false;
  const diff = differenceInCalendarDays(startOfDay(new Date(d)), startOfDay(today));
  return diff >= 0 && diff <= days;
}
/** On time only when both dates exist and actual ≤ plan; missing dates are never "on time". */
export function deliveryOutcome(r: Pick<ExecRequestRow, "planned_delivery_date" | "actual_arrival_date">): "onTime" | "late" | "noDates" {
  if (!r.planned_delivery_date || !r.actual_arrival_date) return "noDates";
  return new Date(r.actual_arrival_date) <= new Date(r.planned_delivery_date) ? "onTime" : "late";
}
export function requestTags(r: ExecRequestRow, today: Date): QueueTag[] {
  const tags: QueueTag[] = [];
  if (isAwaitingPayment(r)) tags.push("payment");
  const overdue = isOverdueDelivery(r, today);
  if (overdue || isUpcomingDelivery(r, today, 3)) tags.push("delivery");
  if (overdue) tags.push("overdue");
  return tags;
}
export const matchesQueue = (item: QueueItem, f: QueueFilter) => f === "all" || item.tags.includes(f);

export function buildSnapshot(open: ExecRequestRow[], today: Date) {
  const s = { active: open.length, fresh: 0, overdue: 0, awaitingPayment: 0, upcoming: 0, invoiced: 0, left: 0, unknownPayment: 0 };
  for (const r of open) {
    if (r.status === "Новая заявка") s.fresh++;
    if (isOverdueDelivery(r, today)) s.overdue++;
    if (isUpcomingDelivery(r, today)) s.upcoming++;
    const total = invoiceTotal(r); if (total) s.invoiced += total;
    const left = paymentLeft(r);
    if (left !== null && left > 0) { s.awaitingPayment++; s.left += left; }
    if (isUnknownPayment(r)) s.unknownPayment++;
  }
  return s;
}
export function requestQueue(open: ExecRequestRow[], today: Date): QueueItem[] {
  return open.flatMap(r => {
    const tags = requestTags(r, today); if (!tags.length) return [];
    const overdue = tags.includes("overdue");
    const reason = [overdue ? `просрочка ${differenceInCalendarDays(startOfDay(today), startOfDay(new Date(r.planned_delivery_date!)))} дн.` : tags.includes("delivery") ? "приход скоро" : "", tags.includes("payment") ? "ждёт оплаты" : ""].filter(Boolean).join(" · ");
    return [{ key: `r:${r.id}`, kind: "request" as const, id: r.id, title: r.description, comment: r.comments, reference: "", objectName: r.object?.name ?? null, owner: r.executor, date: arrival(r), reason, tags, amountLeft: paymentLeft(r) }];
  });
}
export const sortQueue = (items: QueueItem[]) => [...items].sort((a, b) => Number(b.tags.includes("overdue")) - Number(a.tags.includes("overdue")) || (a.date ?? "9999").localeCompare(b.date ?? "9999"));

export function groupBy(open: ExecRequestRow[], key: (r: ExecRequestRow) => string | null, today: Date) {
  const map = new Map<string, { name: string; ids: string[]; overdue: number; left: number; unknown: number }>();
  for (const r of open) {
    const name = key(r)?.trim() || "Не указан";
    const g = map.get(name) ?? { name, ids: [], overdue: 0, left: 0, unknown: 0 };
    g.ids.push(r.id); if (isOverdueDelivery(r, today)) g.overdue++;
    const left = paymentLeft(r); if (left) g.left += left; if (isUnknownPayment(r)) g.unknown++;
    map.set(name, g);
  }
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.ids.length - a.ids.length);
}
export function dataQuality(open: ExecRequestRow[]) {
  return [
    { key: "noAmount", label: "Нет суммы ни в одном счёте", items: open.filter(r => invoiceTotal(r) === null) },
    { key: "unknownPayment", label: "Не указан факт оплаты", items: open.filter(isUnknownPayment) },
    { key: "noDates", label: "Нет плановой даты прихода", items: open.filter(r => !r.planned_delivery_date && !r.actual_arrival_date) },
    { key: "noExecutor", label: "Не назначен исполнитель", items: open.filter(r => !r.executor?.trim()) },
  ];
}
export const periodStart = (today: Date, days: number) => addDays(startOfDay(today), -days + 1);
