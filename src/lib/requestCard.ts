export const REQUEST_ROUTE_LABELS = ["Новая заявка", "Счёт", "В пути", "Доставлено"] as const;

export type RequestRouteState = {
  invoice_number?: string | null;
  shipment_date?: string | null;
  delivery_date?: string | null;
  actual_arrival_date?: string | null;
  status?: string | null;
};

export function isRequestDeliveryConfirmed(request: RequestRouteState): boolean {
  return request.status === "Доставлено" && Boolean(request.actual_arrival_date);
}

export function getRequestRouteStage(request: RequestRouteState): number {
  const status = request.status || "";
  if (isRequestDeliveryConfirmed(request)) return 3;
  if (request.shipment_date || request.actual_arrival_date || ["В пути", "Доставлено в ТК", "Доставлено"].includes(status)) return 2;
  if (request.invoice_number || /сч[её]т|в работе|готов к отгрузке/i.test(status)) return 1;
  return 0;
}

export function isRequestRouteStepDone(request: RequestRouteState, index: number): boolean {
  const current = getRequestRouteStage(request);
  return index < current || (index === 3 && isRequestDeliveryConfirmed(request));
}

export function getRequestObjectLabel(
  objectId: string | null | undefined,
  objectName: string | null | undefined,
): string {
  if (objectName?.trim()) return objectName.trim();
  return objectId ? "Объект недоступен" : "Объект не указан";
}
