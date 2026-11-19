import { differenceInDays, startOfToday, parseISO, startOfDay } from "date-fns";

export const CLOSED_REQUEST_STATUSES = ["Выполнено", "Доставлено", "Закрыто", "Отменено", "Отмена"];

type StaleRequest = {
  status: string;
  updated_at?: string | null;
  created_at: string;
};

const COMPLETED_STATUSES = new Set(["Доставлено", "Выполнено"]);

export function getStaleDays(request: StaleRequest, today = startOfToday()): number {
  const activityDate = new Date(request.updated_at || request.created_at);
  if (Number.isNaN(activityDate.getTime())) return 0;
  return Math.max(0, differenceInDays(today, activityDate));
}

export function isStale(request: StaleRequest, today = startOfToday()): boolean {
  return !COMPLETED_STATUSES.has(request.status) && getStaleDays(request, today) > 2;
}

export function isOpenRequest(request: { status: string }): boolean {
  return !CLOSED_REQUEST_STATUSES.includes(request.status);
}

export function isOverdueDelivery(request: { status: string; planned_delivery_date?: string | null; delivery_date?: string | null; actual_arrival_date?: string | null }, today = startOfToday()): boolean {
  if (!isOpenRequest(request) || request.actual_arrival_date) return false;
  const value = request.planned_delivery_date || request.delivery_date;
  if (!value) return false;
  const planned = parseISO(value);
  return !Number.isNaN(planned.getTime()) && startOfDay(planned) < startOfDay(today);
}
