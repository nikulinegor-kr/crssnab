/** Короткий постоянный номер заявки: REQ- и ровно 5 цифр с ведущими нулями.
 * Источник — серверный public_number (последовательность + UNIQUE). Без него — null,
 * чтобы не выдумывать номер из старого request_number. */
export function formatRequestPublicNumber(req: { public_number?: number | string | null } | null | undefined): string | null {
  const raw = req?.public_number;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isSafeInteger(n) || n < 1 || n > 99999) return null;
  return `REQ-${String(n).padStart(5, "0")}`;
}
