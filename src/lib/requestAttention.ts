import { isBefore, startOfToday } from "date-fns";

type AttentionRequest = {
  status: string;
  delivery_date?: string | null;
  amount?: number;
  payment_percent?: number | null;
  payment_percentage?: number | null;
};

export function isNewRequest(r: AttentionRequest): boolean {
  return r.status === "Новая заявка";
}

export function isOverdue(r: AttentionRequest, today = startOfToday()): boolean {
  if (r.status === "Доставлено" || r.status === "Выполнено") return false;
  if (!r.delivery_date) return false;
  return isBefore(new Date(r.delivery_date), today);
}

export function isUnpaid(r: AttentionRequest): boolean {
  if (r.status === "Доставлено" || r.status === "Выполнено") return false;
  const pct = (r as any).payment_percent ?? r.payment_percentage ?? 0;
  return pct === 0 && (r.amount ?? 0) > 0;
}

export { isStale } from "./requestStaleness";
