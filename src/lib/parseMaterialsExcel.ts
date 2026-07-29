import * as XLSX from "xlsx";

export interface ParsedMaterialRow {
  name: string;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  total_price: number | null;
}

const NAME_PATTERNS = ["наименование", "название", "материал", "товар", "позиция", "работ", "name", "description"];
const UNIT_PATTERNS = ["ед.изм", "ед. изм", "единица", "ед изм", "ед-ца", "изм.", "изм", "ед.", " ед", "unit"];
const QTY_PATTERNS = ["кол-во", "кол во", "количество", "объем", "объём", "кол.", "quantity", "qty"];
const PRICE_PATTERNS = ["цена", "стоимость за", "цена за", "price"];
const TOTAL_PATTERNS = ["сумма", "всего", "итого", "общая стоимость", "total"];

const norm = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const matches = (cell: string, patterns: string[]) => patterns.some((p) => cell.includes(p));

export function parseNumberLoose(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const s = String(val)
    .replace(/[\s\u00a0]/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, ".");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const SKIP_NAME = /^(итого|всего|итог|раздел|подраздел|№|n\s*п\/п|примечание)\b/i;

function parseSheet(rows: any[][]): ParsedMaterialRow[] {
  if (!rows.length) return [];

  let headerIdx = -1;
  let nameCol = -1;
  let unitCol = -1;
  let qtyCol = -1;
  let priceCol = -1;
  let totalCol = -1;

  const scanLimit = Math.min(rows.length, 60);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] || [];
    let n = -1, u = -1, q = -1, p = -1, t = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (!cell) continue;
      if (n === -1 && matches(cell, NAME_PATTERNS)) { n = c; continue; }
      if (u === -1 && matches(cell, UNIT_PATTERNS)) { u = c; continue; }
      if (q === -1 && matches(cell, QTY_PATTERNS)) { q = c; continue; }
      if (p === -1 && matches(cell, PRICE_PATTERNS)) { p = c; continue; }
      if (t === -1 && matches(cell, TOTAL_PATTERNS)) { t = c; continue; }
    }
    if (n !== -1 && (u !== -1 || q !== -1 || p !== -1 || t !== -1)) {
      headerIdx = r; nameCol = n; unitCol = u; qtyCol = q; priceCol = p; totalCol = t;
      break;
    }
    if (n !== -1 && headerIdx === -1) {
      headerIdx = r; nameCol = n; unitCol = u; qtyCol = q; priceCol = p; totalCol = t;
    }
  }

  // Fallback: no header found — pick the column with the most long text values.
  if (headerIdx === -1) {
    const scores: number[] = [];
    for (const row of rows.slice(0, 200)) {
      (row || []).forEach((cell, c) => {
        const s = String(cell ?? "").trim();
        if (s.length >= 6 && /[а-яa-z]/i.test(s)) scores[c] = (scores[c] || 0) + 1;
      });
    }
    let best = -1, bestScore = 0;
    scores.forEach((s, c) => { if (s > bestScore) { bestScore = s; best = c; } });
    if (best === -1 || bestScore < 3) return [];
    headerIdx = -1; nameCol = best;
  }

  const out: ParsedMaterialRow[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[nameCol] ?? "").replace(/\s+/g, " ").trim();
    if (!name || name.length < 2) continue;
    if (/^[\d.,\s]+$/.test(name)) continue;
    if (SKIP_NAME.test(name)) continue;
    out.push({
      name,
      unit: unitCol >= 0 ? String(row[unitCol] ?? "").trim() || null : null,
      quantity: qtyCol >= 0 ? parseNumberLoose(row[qtyCol]) : null,
      price: priceCol >= 0 ? parseNumberLoose(row[priceCol]) : null,
      total_price: totalCol >= 0 ? parseNumberLoose(row[totalCol]) : null,
    });
  }
  return out;
}

/** Parses an xlsx/xls workbook (all sheets) and returns rows from the richest sheet. */
export function parseMaterialsWorkbook(data: Uint8Array): ParsedMaterialRow[] {
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  let best: ParsedMaterialRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", blankrows: false, raw: true });
    const parsed = parseSheet(aoa as any[][]);
    if (parsed.length > best.length) best = parsed;
  }
  return best;
}

export async function parseMaterialsExcelFile(file: File): Promise<ParsedMaterialRow[]> {
  const buffer = await file.arrayBuffer();
  return parseMaterialsWorkbook(new Uint8Array(buffer));
}
