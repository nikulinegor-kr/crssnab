export interface RecognizedWaybill {
  transport_company: string;
  waybill_number: string;
  shipment_date: string;
  delivery_date: string;
}

const DATE_RE = /^(\d{4})-\d{2}-\d{2}$/;
const cleanDate = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  const m = s.match(DATE_RE);
  if (!m) return "";
  const y = Number(m[1]);
  return y >= 2000 && y <= 2100 ? s : "";
};
const cleanText = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Нормализует ответ распознавания ТТН в поля логистики заявки. */
export const normalizeRecognizedWaybill = (data: any): RecognizedWaybill => ({
  transport_company: cleanText(data?.transport_company),
  waybill_number: cleanText(data?.waybill_number),
  shipment_date: cleanDate(data?.load_date),
  delivery_date: cleanDate(data?.planned_arrival_date),
});
