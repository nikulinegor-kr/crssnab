import { useState, useCallback, useEffect } from "react";
import { ColumnVisibility, DEFAULT_COLUMN_VISIBILITY } from "@/components/requests/TableColumnSettings";

const STORAGE_KEY = "requests_table_columns";

export const useTableColumnVisibility = (userId?: string | null) => {
  const storageKey = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new columns
        return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load column visibility:", e);
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(STORAGE_KEY);
      setVisibility(saved ? { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) } : DEFAULT_COLUMN_VISIBILITY);
    } catch (e) {
      console.error("Failed to load column visibility:", e);
      setVisibility(DEFAULT_COLUMN_VISIBILITY);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibility));
    } catch (e) {
      console.error("Failed to save column visibility:", e);
    }
  }, [storageKey, visibility]);

  const updateVisibility = useCallback((newVisibility: ColumnVisibility) => {
    setVisibility(newVisibility);
  }, []);

  const resetToDefaults = useCallback(() => {
    setVisibility(DEFAULT_COLUMN_VISIBILITY);
  }, []);

  return {
    visibility,
    updateVisibility,
    resetToDefaults,
  };
};
