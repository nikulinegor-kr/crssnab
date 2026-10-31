export type RequestQrAction = 'shipment' | 'transit' | 'receipt' | 'received' | 'details';
export function requestQrAction(status: string, received = false): RequestQrAction {
  if (received) return 'received';
  if (status === 'Готов к отгрузке') return 'shipment';
  if (status === 'В пути') return 'transit';
  if (status === 'Доставлено') return 'receipt';
  return 'details';
}
export function shipmentDatesError(carrier: string | null, shipment: string, arrival: string): string | null {
  if (!carrier || !shipment || !arrival) return 'Укажите ТК, дату отгрузки и плановую дату прихода';
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0,4)) >= 2000 && Number(v.slice(0,4)) <= 2100 && new Date(v).toISOString().slice(0,10) === v;
  try { if (!valid(shipment) || !valid(arrival)) return 'Проверьте даты (2000–2100)'; } catch { return 'Проверьте даты'; }
  return arrival < shipment ? 'Плановый приход не может быть раньше отгрузки' : null;
}