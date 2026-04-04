import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "requests-column-widths";

export interface ColumnWidths {
  checkbox: number;
  row_number: number;
  request_date: number;
  description: number;
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
  amount: number;
  applicant: number;
  comments: number;
  equipment: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 40,
  row_number: 36,
  request_date: 90,
  description: 250,
  priority: 110,
  status: 130,
  availability: 100,
  contractor: 130,
  invoice_number: 100,
  payment_percentage: 80,
  shipment_date: 95,
  delivery_date: 95,
  transport_company: 100,
  amount: 110,
  applicant: 110,
  comments: 150,
  equipment: 120,
};

export const MIN_COLUMN_WIDTH = 28;

export const useTableColumnWidths = () => {
  const [widths, setWidths] = useState<ColumnWidths>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load column widths:", e);
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error("Failed to save column widths:", e);
    }
  }, [widths]);

  const updateWidth = useCallback((column: keyof ColumnWidths, width: number) => {
    setWidths((prev) => ({
      ...prev,
      [column]: Math.max(MIN_COLUMN_WIDTH, width),
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setWidths(DEFAULT_COLUMN_WIDTHS);
  }, []);

  return {
    widths,
    updateWidth,
    resetToDefaults,
  };
};
