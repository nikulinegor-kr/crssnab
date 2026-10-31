/** Pure aggregation of posted warehouse issues by CRM object. Rows come only from warehouse_issues,
 * which the server writes exclusively when an issue document is posted (drafts never appear). */
export interface IssueRow { id: string; organization_id: string; unit_id: string; warehouse_id: string; recipient_name: string; request_id: string | null; object_id: string | null; equipment_id: string | null; operation_date: string | null; created_at: string; issued_qty: number; returned_qty: number }
export interface IssueUnit { id: string; name: string; unit: string; product_id: string | null }
export const NO_OBJECT = 'none';

export interface ObjectSummary { objectId: string; positions: number; issues: number }
export interface PositionTotal { unitId: string; name: string; unit: string; issued: number; returned: number; onObject: number; issues: number }

export const objectKey = (r: Pick<IssueRow, 'object_id'>) => r.object_id ?? NO_OBJECT;

/** Rows of one organization only (defence in depth on top of RLS). */
export const orgRows = (rows: IssueRow[], orgId: string) => rows.filter(r => r.organization_id === orgId);

export function summarizeByObject(rows: IssueRow[]): Map<string, ObjectSummary> {
  const out = new Map<string, ObjectSummary & { units: Set<string> }>();
  for (const r of rows) {
    const k = objectKey(r);
    const s = out.get(k) ?? { objectId: k, positions: 0, issues: 0, units: new Set<string>() };
    s.issues++; s.units.add(r.unit_id); s.positions = s.units.size; out.set(k, s);
  }
  return new Map([...out].map(([k, { units: _u, ...s }]) => [k, s]));
}

/** Totals per stable warehouse unit id (never merged by name), with its own unit of measure. */
export function positionTotals(rows: IssueRow[], units: IssueUnit[]): PositionTotal[] {
  const out = new Map<string, PositionTotal>();
  for (const r of rows) {
    const u = units.find(x => x.id === r.unit_id);
    const t = out.get(r.unit_id) ?? { unitId: r.unit_id, name: u?.name ?? '—', unit: u?.unit ?? '', issued: 0, returned: 0, onObject: 0, issues: 0 };
    t.issued += Number(r.issued_qty); t.returned += Number(r.returned_qty); t.onObject = t.issued - t.returned; t.issues++;
    out.set(r.unit_id, t);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export const issueDate = (r: IssueRow) => r.operation_date ?? r.created_at.slice(0, 10);

export function filterIssues(rows: IssueRow[], opts: { from?: string; to?: string; search?: string; text: (r: IssueRow) => string }): IssueRow[] {
  const terms = (opts.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    const d = issueDate(r);
    if (opts.from && d < opts.from) return false;
    if (opts.to && d > opts.to) return false;
    const t = opts.text(r).toLowerCase();
    return terms.every(x => t.includes(x));
  });
}
