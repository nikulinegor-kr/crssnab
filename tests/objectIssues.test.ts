import { describe, it, expect } from 'vitest';
import { summarizeByObject, positionTotals, orgRows, filterIssues, NO_OBJECT, type IssueRow } from '../src/lib/objectIssues';

const base = { warehouse_id: 'w1', recipient_name: 'Иванов', request_id: null, equipment_id: null, returned_qty: 0, created_at: '2026-10-01T10:00:00Z', operation_date: null };
const rows: IssueRow[] = [
  { ...base, id: '1', organization_id: 'A', unit_id: 'u1', object_id: 'o1', issued_qty: 5, operation_date: '2026-10-01' },
  { ...base, id: '2', organization_id: 'A', unit_id: 'u1', object_id: 'o1', issued_qty: 3, returned_qty: 2, operation_date: '2026-10-10' },
  { ...base, id: '3', organization_id: 'A', unit_id: 'u2', object_id: 'o1', issued_qty: 1 },
  { ...base, id: '4', organization_id: 'A', unit_id: 'u3', object_id: 'o2', issued_qty: 10 },
  { ...base, id: '5', organization_id: 'A', unit_id: 'u4', object_id: null, equipment_id: 'e1', issued_qty: 1 },
  { ...base, id: '6', organization_id: 'B', unit_id: 'u9', object_id: 'o1', issued_qty: 99 },
];
const units = [
  { id: 'u1', name: 'Кабель', unit: 'м', product_id: null },
  { id: 'u2', name: 'Кабель', unit: 'шт', product_id: null },
  { id: 'u3', name: 'Краска', unit: 'л', product_id: null },
  { id: 'u4', name: 'Фильтр', unit: 'шт', product_id: null },
];

describe('object issues', () => {
  const mine = orgRows(rows, 'A');
  it('excludes another organization', () => { expect(mine.some(r => r.organization_id === 'B')).toBe(false); });
  it('counts positions and issues per object', () => {
    const s = summarizeByObject(mine);
    expect(s.get('o1')).toEqual({ objectId: 'o1', positions: 2, issues: 3 });
    expect(s.get('o2')).toEqual({ objectId: 'o2', positions: 1, issues: 1 });
  });
  it('keeps equipment-only issues in the no-object group', () => {
    expect(summarizeByObject(mine).get(NO_OBJECT)?.issues).toBe(1);
  });
  it('separates issued, returned and remaining on object for repeated issues', () => {
    const t = positionTotals(mine.filter(r => r.object_id === 'o1'), units).find(x => x.unitId === 'u1')!;
    expect([t.issued, t.returned, t.onObject, t.issues]).toEqual([8, 2, 6, 2]);
  });
  it('does not merge same names with different units', () => {
    const t = positionTotals(mine.filter(r => r.object_id === 'o1'), units);
    expect(t.map(x => x.unit).sort()).toEqual(['м', 'шт']);
  });
  it('filters by period', () => {
    expect(filterIssues(mine, { from: '2026-10-05', text: () => '' }).map(r => r.id)).toEqual(['2']);
  });
});
