import { expect, test } from 'bun:test';
import { canSubmit, fallbackExpected, hasDiscrepancy, lineErrors, payload, receivedByItem, remaining, type DraftLine } from '../src/lib/partialReceipt';

const line = (p: Partial<DraftLine>): DraftLine => ({ id: 'i1', name: 'Фильтр', expected: 10, done: 0, accepted: '', defect: '', note: '', unit: 'шт', photos: [], ...p });

test('8 of 10 is a discrepancy that must be confirmed; then 2 more completes', () => {
  const first = [line({ accepted: 8 })];
  expect(hasDiscrepancy(first)).toBe(true);
  expect(canSubmit(first, false)).toBe(false);
  expect(canSubmit(first, true)).toBe(true);
  const done = receivedByItem([{ request_item_id: 'i1', expected_qty: 10, accepted_qty: 8, defect_qty: 0 }]).get('i1') ?? 0;
  expect(remaining(10, done)).toBe(2);
  const second = [line({ done, accepted: 2 })];
  expect(hasDiscrepancy(second)).toBe(false);
  expect(canSubmit(second, false)).toBe(true);
});

test('cannot exceed what is left; defect needs a note', () => {
  expect(lineErrors(line({ done: 8, accepted: 3 }))).toContain('Больше ожидаемого: осталось 2');
  expect(lineErrors(line({ accepted: 1, defect: 1 }))).toContain('Для брака укажите примечание');
  expect(canSubmit([line({ accepted: 9, defect: 1, note: 'Трещина' })], false)).toBe(false);
});

test('request without items asks for explicit expected quantity once', () => {
  expect(lineErrors(line({ id: null, expected: '', accepted: 1 }))).toContain('Подтвердите ожидаемое количество');
  expect(payload([line({ id: null, expected: 5, accepted: 2 })], false)[0]).toMatchObject({ item_id: null, expected: 5, accepted: 2 });
  expect(payload([line({ id: null, expected: 5, accepted: 2 })], true)[0]).not.toHaveProperty('expected');
  expect(fallbackExpected([{ request_item_id: null, expected_qty: 5, accepted_qty: 2, defect_qty: 0 }])).toBe(5);
});
