import { REQUEST_ROUTE_LABELS, getRequestRouteStage, type RequestRouteState } from "./requestCard";

export type MobileListRequest = RequestRouteState & {
  id: string;
  request_date?: string | null;
  created_at?: string | null;
  planned_delivery_date?: string | null;
  transport_company?: string | null;
};

/** Приход: фактический, затем плановый, затем дата доставки. */
export function mobileArrivalDate(r: MobileListRequest): string | null {
  return r.actual_arrival_date || r.planned_delivery_date || r.delivery_date || null;
}

export function formatArrival(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}.${m[2]}` : "—";
}

export function isArrivalOverdue(r: MobileListRequest, today = new Date()): boolean {
  if (r.actual_arrival_date || r.status === "Доставлено") return false;
  const d = r.planned_delivery_date || r.delivery_date;
  if (!d) return false;
  const t = today.toISOString().slice(0, 10);
  return d.slice(0, 10) < t;
}

/** На телефоне «Скрыть доставленные» скрывает все «Доставлено», пока статус не выбран явно. */
export function applyMobileHideDelivered<T extends { status?: string | null }>(rows: T[], hideDelivered: boolean, statusFilter: string[]): T[] {
  if (!hideDelivered || statusFilter.includes("Доставлено")) return rows;
  return rows.filter((r) => r.status !== "Доставлено");
}

export function groupMobileRequests<T extends MobileListRequest>(rows: T[]) {
  const key = (r: T) => r.request_date || r.created_at || "";
  return REQUEST_ROUTE_LABELS.map((label, stage) => ({
    stage,
    label,
    items: rows.filter((r) => getRequestRouteStage(r) === stage).sort((a, b) => key(b).localeCompare(key(a))),
  })).filter((g) => g.items.length > 0);
}
