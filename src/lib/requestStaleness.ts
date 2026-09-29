import { differenceInDays, startOfToday } from "date-fns";

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