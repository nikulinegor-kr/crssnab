/* eslint-disable @typescript-eslint/no-explicit-any */
export const RECENT_ARRIVAL_DAYS = 10;
export const arrivalTime = (r: any): number => {
  const v = r?.actual_arrival_date || r?.delivery_date || r?.updated_at;
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};
export const isRecentArrival = (r: any): boolean => {
  if (r?.status !== "Доставлено") return false;
  const t = arrivalTime(r);
  return t > 0 && t >= Date.now() - RECENT_ARRIVAL_DAYS * 86400000 && t <= Date.now() + 86400000;
};
