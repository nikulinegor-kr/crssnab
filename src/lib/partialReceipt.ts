/** Pure partial-receipt math shared by the receipt form and tests. The server re-checks every rule. */
export const RECEIPT_STATUSES = ['В пути', 'Доставлено в ТК', 'Доставлено'] as const;
export const canReceiveStatus = (status: string) => (RECEIPT_STATUSES as readonly string[]).includes(status);

export interface ReceivedLine { request_item_id: string | null; expected_qty: number; accepted_qty: number; defect_qty: number }
export interface ExpectedItem { id: string | null; name: string; expected: number | null }
export interface DraftLine { id: string | null; name: string; expected: number | ''; done: number; accepted: number | ''; defect: number | ''; note: string; unit: 'шт' | 'комплект'; photos: string[] }

const n = (v: number | '') => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Sum already received (good + defect) per request item; null key = request without items. */
export function receivedByItem(lines: ReceivedLine[]): Map<string | null, number> {
  const out = new Map<string | null, number>();
  for (const l of lines) out.set(l.request_item_id, (out.get(l.request_item_id) ?? 0) + Number(l.accepted_qty) + Number(l.defect_qty));
  return out;
}

/** Fallback (no request items): expected is the first confirmed quantity, never re-entered. */
export function fallbackExpected(lines: ReceivedLine[]): number | null {
  const first = lines.find(l => l.request_item_id === null);
  return first ? Number(first.expected_qty) : null;
}

export function remaining(expected: number | '', done: number) { return Math.max(0, n(expected) - done); }

export function lineErrors(l: DraftLine): string[] {
  const e: string[] = [];
  if (l.id === null && n(l.expected) <= 0) e.push('Подтвердите ожидаемое количество');
  if (n(l.accepted) < 0 || n(l.defect) < 0) e.push('Количество не может быть отрицательным');
  if (n(l.accepted) + n(l.defect) > remaining(l.expected, l.done)) e.push(`Больше ожидаемого: осталось ${remaining(l.expected, l.done)}`);
  if (n(l.defect) > 0 && !l.note.trim()) e.push('Для брака укажите примечание');
  return e;
}

/** Lines actually sent: only those with something received now. */
export const activeLines = (lines: DraftLine[]) => lines.filter(l => n(l.accepted) + n(l.defect) > 0);

/** Discrepancy = any defect now, or anything still left to receive after this batch (over all items). */
export function hasDiscrepancy(lines: DraftLine[]) {
  return lines.some(l => n(l.defect) > 0 || n(l.accepted) + n(l.defect) < remaining(l.expected, l.done));
}

export function canSubmit(lines: DraftLine[], confirmed: boolean) {
  const active = activeLines(lines);
  if (!active.length) return false;
  if (lines.some(l => lineErrors(l).length && activeLines([l]).length)) return false;
  return !hasDiscrepancy(lines) || confirmed;
}

export function payload(lines: DraftLine[], fallbackKnown: boolean) {
  return activeLines(lines).map(l => ({ item_id: l.id, accepted: n(l.accepted), defect: n(l.defect), note: l.note.trim() || null, unit: l.unit, photos: l.photos, ...(l.id === null && !fallbackKnown ? { expected: n(l.expected) } : {}) }));
}
