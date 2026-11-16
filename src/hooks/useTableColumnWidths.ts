import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "requests-column-widths";

export interface ColumnWidths {
  checkbox: number;
  row_number: number;
  request_date: number;
  description: number;
  object: number;
  priority: number;
  status: number;
  availability: number;
  contractor: number;
  invoice_number: number;
  payment_prepay: number;
  payment_percentage: number;
  shipment_date: number;
  delivery_date: number;
  transport_company: number;
  waybill_number: number;
  amount: number;
  applicant: number;
  executor: number;
  comments: number;
  equipment: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 40,
  row_number: 36,
  // Фиксированные ширины: максимум из заголовка (+иконка сортировки) и самого
  // длинного штатного значения с отступами и значками.
  request_date: 96,
  description: 260,
  object: 168,
  priority: 148,
  status: 200,
  availability: 120,
  contractor: 168,
  invoice_number: 136,
  payment_prepay: 112,
  payment_percentage: 184,
  shipment_date: 128,
  delivery_date: 128,
  transport_company: 120,
  waybill_number: 176,
  amount: 168,
  applicant: 150,
  executor: 150,
  comments: 220,
  equipment: 136,
};

export const MIN_COLUMN_WIDTH = 28;

/** Только эти колонки меняют ширину; остальные фиксированы. */
export const RESIZABLE_COLUMNS = {
  description: { min: 160, max: 640 },
  comments: { min: 120, max: 600 },
} as const;
export type ResizableColumn = keyof typeof RESIZABLE_COLUMNS;

export const clampResizableWidth = (column: ResizableColumn, width: number) => {
  const { min, max } = RESIZABLE_COLUMNS[column];
  return Math.round(Math.min(max, Math.max(min, width)));
};

const pickResizable = (source: Partial<ColumnWidths>): ColumnWidths => {
  const next = { ...DEFAULT_COLUMN_WIDTHS };
  (Object.keys(RESIZABLE_COLUMNS) as ResizableColumn[]).forEach((column) => {
    const value = Number(source[column]);
    if (Number.isFinite(value)) next[column] = clampResizableWidth(column, value);
  });
  return next;
};

const SYNC_EVENT = "requests-column-widths-change";

const readSaved = (): ColumnWidths => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return pickResizable(JSON.parse(saved));
  } catch (e) {
    console.error("Failed to load column widths:", e);
  }
  return DEFAULT_COLUMN_WIDTHS;
};

const persist = (next: ColumnWidths) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ description: next.description, comments: next.comments }));
  } catch (e) {
    console.error("Failed to save column widths:", e);
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
};

/** Ширины колонок реестра; экземпляры (таблица и меню «Колонки») синхронизированы. */
export const useTableColumnWidths = () => {
  const [widths, setWidths] = useState<ColumnWidths>(readSaved);

  useEffect(() => {
    const sync = () => setWidths(readSaved());
    window.addEventListener(SYNC_EVENT, sync);
    return () => window.removeEventListener(SYNC_EVENT, sync);
  }, []);

  const updateWidth = useCallback((column: keyof ColumnWidths, width: number) => {
    if (!(column in RESIZABLE_COLUMNS)) return;
    const key = column as ResizableColumn;
    const current = readSaved();
    persist({ ...current, [key]: clampResizableWidth(key, width) });
  }, []);

  const resetToDefaults = useCallback(() => {
    persist(DEFAULT_COLUMN_WIDTHS);
  }, []);

  return { widths, updateWidth, resetToDefaults };
};
