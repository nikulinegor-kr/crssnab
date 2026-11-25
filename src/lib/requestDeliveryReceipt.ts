const deliveryReceiptEvent = "crss:request-delivery-receipt";

export type RequestWorkflowPatch = { status: string; updated_at: string; shipment_date?: string | null; delivery_date?: string | null; transport_company?: string | null; actual_arrival_date?: string | null };
type WorkflowSaved = (patch: RequestWorkflowPatch) => void;
export type DeliveryReceiptIntent = { requestId: string; actualDate?: string; onSaved?: WorkflowSaved };

export function openRequestDeliveryReceipt(requestId: string, actualDate?: string, onSaved?: WorkflowSaved) {
  window.dispatchEvent(new CustomEvent<DeliveryReceiptIntent>(deliveryReceiptEvent, { detail: { requestId, actualDate, onSaved } }));
}

export function subscribeToRequestDeliveryReceipt(callback: (intent: DeliveryReceiptIntent) => void) {
  const listener = (event: Event) => callback((event as CustomEvent<DeliveryReceiptIntent>).detail);
  window.addEventListener(deliveryReceiptEvent, listener);
  return () => window.removeEventListener(deliveryReceiptEvent, listener);
}

export const logisticsStatuses = ["В работе", "Готов к отгрузке", "В пути"] as const;
export const requiresLogistics = (status: string) => (logisticsStatuses as readonly string[]).includes(status.trim());
export type LogisticsIntent = { requestId: string; status?: string; percent?: number; onSaved?: WorkflowSaved };
const logisticsEvent = "crss:request-logistics";
export function openRequestLogistics(intent: LogisticsIntent) {
  window.dispatchEvent(new CustomEvent<LogisticsIntent>(logisticsEvent, { detail: intent }));
}
export function subscribeToRequestLogistics(callback: (intent: LogisticsIntent) => void) {
  const listener = (event: Event) => callback((event as CustomEvent<LogisticsIntent>).detail);
  window.addEventListener(logisticsEvent, listener);
  return () => window.removeEventListener(logisticsEvent, listener);
}

export function interceptRequestStatus(requestId: string, status: string, onSaved?: WorkflowSaved) {
  if (status.trim() === "Доставлено") {
    openRequestDeliveryReceipt(requestId, undefined, onSaved);
    return true;
  }
  if (requiresLogistics(status)) {
    openRequestLogistics({ requestId, status: status.trim(), onSaved });
    return true;
  }
  return false;
}
