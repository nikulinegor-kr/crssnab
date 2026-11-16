export const REQUEST_ROUTE_LABELS = ["Новая заявка", "Счёт", "В пути"] as const;

export type RequestRouteState = {
  invoice_number?: string | null;
  shipment_date?: string | null;
  delivery_date?: string | null;
  actual_arrival_date?: string | null;
  status?: string | null;
};

export function getRequestRouteStage(request: RequestRouteState): number {
  const status = request.status || "";
  if (request.shipment_date || request.actual_arrival_date || ["В пути", "Доставлено в ТК", "Доставлено"].includes(status)) return 2;
  if (request.invoice_number || /сч[её]т|в работе|готов к отгрузке/i.test(status)) return 1;
  return 0;
}

export function isRequestRouteStepDone(request: RequestRouteState, index: number): boolean {
  const completed = Boolean(request.actual_arrival_date || request.status === "Доставлено");
  if (completed) return true;
  if (index === 0) return getRequestRouteStage(request) > 0;
  if (index === 1) return getRequestRouteStage(request) > 1;
  return false;
}

export function getRequestObjectLabel(
  objectId: string | null | undefined,
  objectName: string | null | undefined,
): string {
  if (objectName?.trim()) return objectName.trim();
  return objectId ? "Объект недоступен" : "Объект не указан";
}
