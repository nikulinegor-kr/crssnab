/** Pure split of one posted issue into its states. Issued is history; only "числится" is still with the recipient.
 * Historical issues have installed/consumed = 0, so they stay "числится" until someone records otherwise. */
export interface IssueQty { issued_qty: number; returned_qty: number; installed_qty?: number | null; consumed_qty?: number | null }
export interface IssueSplit { issued: number; returned: number; installed: number; consumed: number; outstanding: number }

export function issueSplit(i: IssueQty): IssueSplit {
  const issued = Number(i.issued_qty), returned = Number(i.returned_qty), installed = Number(i.installed_qty ?? 0), consumed = Number(i.consumed_qty ?? 0);
  return { issued, returned, installed, consumed, outstanding: Math.max(0, issued - returned - installed - consumed) };
}

export type IssueGroup = 'object' | 'equipment' | 'employee';
export interface IssueTarget { object_id: string | null; equipment_id: string | null; recipient_user_id?: string | null }
/** Group key for the "Выдано" screen: object first, then equipment, then the employee personally. */
export function issueGroup(i: IssueTarget): { group: IssueGroup; id: string } {
  if (i.object_id) return { group: 'object', id: i.object_id };
  if (i.equipment_id) return { group: 'equipment', id: i.equipment_id };
  return { group: 'employee', id: i.recipient_user_id ?? 'unknown' };
}

/** Totals per unit of measure — different units are never summed together. */
export function totalsByUnit(rows: { unit: string; split: IssueSplit }[]): { unit: string; issued: number; outstanding: number; installed: number; consumed: number; returned: number }[] {
  const m = new Map<string, { unit: string; issued: number; outstanding: number; installed: number; consumed: number; returned: number }>();
  for (const r of rows) {
    const t = m.get(r.unit) ?? { unit: r.unit, issued: 0, outstanding: 0, installed: 0, consumed: 0, returned: 0 };
    t.issued += r.split.issued; t.outstanding += r.split.outstanding; t.installed += r.split.installed; t.consumed += r.split.consumed; t.returned += r.split.returned;
    m.set(r.unit, t);
  }
  return [...m.values()];
}

export const fmtQty = (n: number) => Number(n.toFixed(3)).toLocaleString('ru-RU');
