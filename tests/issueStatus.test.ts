import { expect, test } from 'bun:test';
import { issueGroup, issueSplit, totalsByUnit } from '../src/lib/issueStatus';

test('issued 10, returned 2, consumed 3 -> 5 still assigned; issued history stays 10', () => {
  const s = issueSplit({ issued_qty: 10, returned_qty: 2, installed_qty: 0, consumed_qty: 3 });
  expect(s.outstanding).toBe(5);
  expect(s.issued).toBe(10);
});

test('historical issue without new fields stays fully assigned (not silently consumed)', () => {
  expect(issueSplit({ issued_qty: 4, returned_qty: 1 })).toMatchObject({ outstanding: 3, consumed: 0, installed: 0 });
});

test('grouping prefers object, then equipment, then employee', () => {
  expect(issueGroup({ object_id: 'o', equipment_id: 'e', recipient_user_id: 'u' })).toEqual({ group: 'object', id: 'o' });
  expect(issueGroup({ object_id: null, equipment_id: 'e' })).toEqual({ group: 'equipment', id: 'e' });
  expect(issueGroup({ object_id: null, equipment_id: null, recipient_user_id: 'u' })).toEqual({ group: 'employee', id: 'u' });
});

test('different units are never summed together', () => {
  const t = totalsByUnit([{ unit: 'шт', split: issueSplit({ issued_qty: 2, returned_qty: 0 }) }, { unit: 'комплект', split: issueSplit({ issued_qty: 1, returned_qty: 0 }) }, { unit: 'шт', split: issueSplit({ issued_qty: 3, returned_qty: 1 }) }]);
  expect(t).toHaveLength(2);
  expect(t.find(x => x.unit === 'шт')).toMatchObject({ issued: 5, outstanding: 4 });
});
