import { useState, useCallback, useEffect } from "react";
import { ColumnVisibility, DEFAULT_COLUMN_VISIBILITY } from "@/components/requests/TableColumnSettings";

const STORAGE_KEY = "requests-column-visibility";

export const useTableColumnVisibility = () => {
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    } catch (e) {
      console.error("Failed to save column visibility:", e);
    }
  }, [visibility]);

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
