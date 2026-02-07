import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_ACTIVE = "deadstock-active-column-widths";
const STORAGE_KEY_ARCHIVE = "deadstock-archive-column-widths";

type Widths = Record<string, number>;

export const DEFAULT_ACTIVE_WIDTHS: Widths = {
  name: 180,
  qty: 70,
  description: 250,
  part_number: 120,
  price: 100,
  responsible: 140,
  action: 100,
};

export const DEFAULT_ARCHIVE_WIDTHS: Widths = {
  sold_at: 100,
  name: 160,
  qty: 60,
  part_number: 110,
  price: 90,
  buyer: 130,
  invoice_number: 100,
  tk: 90,
  shipped_at: 95,
  arrived_at: 95,
  responsible: 130,
  action: 60,
};

function useWidths(storageKey: string, defaults: Widths) {
  const [widths, setWidths] = useState<Widths>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch {}
  }, [widths, storageKey]);

  const updateWidth = useCallback((col: string, w: number) => {
    setWidths(prev => ({ ...prev, [col]: Math.max(50, w) }));
  }, []);

  return { widths, updateWidth };
}

export const useDeadstockActiveWidths = () => useWidths(STORAGE_KEY_ACTIVE, DEFAULT_ACTIVE_WIDTHS);
export const useDeadstockArchiveWidths = () => useWidths(STORAGE_KEY_ARCHIVE, DEFAULT_ARCHIVE_WIDTHS);
