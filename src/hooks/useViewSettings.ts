import { useState, useEffect } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

export interface DashboardSettings {
  showStatsCards: boolean;
  showAnalyticsTabs: boolean;
  showCalendarWidget: boolean;
  showEmergencyWidget: boolean;
  showRecentRequests: boolean;
}

export interface KanbanSettings {
  showPriority: boolean;
  showDeadline: boolean;
  showExecutor: boolean;
  showApplicant: boolean;
  showContractor: boolean;
  showRequestNumber: boolean;
}

export interface ViewSettings {
  dashboard: DashboardSettings;
  kanban: KanbanSettings;
}

const defaultSettings: ViewSettings = {
  dashboard: {
    showStatsCards: true,
    showAnalyticsTabs: true,
    showCalendarWidget: true,
    showEmergencyWidget: true,
    showRecentRequests: true,
  },
  kanban: {
    showPriority: true,
    showDeadline: true,
    showExecutor: true,
    showApplicant: true,
    showContractor: true,
    showRequestNumber: true,
  },
};

export const useViewSettings = () => {
  const { currentOrgId } = useCurrentOrganization();
  const [settings, setSettings] = useState<ViewSettings>(defaultSettings);

  const storageKey = `view-settings-${currentOrgId}`;

  useEffect(() => {
    if (!currentOrgId) return;
    
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch {
        setSettings(defaultSettings);
      }
    }
  }, [currentOrgId, storageKey]);

  const updateDashboardSettings = (updates: Partial<DashboardSettings>) => {
    const newSettings = {
      ...settings,
      dashboard: { ...settings.dashboard, ...updates },
    };
    setSettings(newSettings);
    localStorage.setItem(storageKey, JSON.stringify(newSettings));
  };

  const updateKanbanSettings = (updates: Partial<KanbanSettings>) => {
    const newSettings = {
      ...settings,
      kanban: { ...settings.kanban, ...updates },
    };
    setSettings(newSettings);
    localStorage.setItem(storageKey, JSON.stringify(newSettings));
  };

  const resetToDefault = () => {
    setSettings(defaultSettings);
    localStorage.setItem(storageKey, JSON.stringify(defaultSettings));
  };

  return {
    settings,
    updateDashboardSettings,
    updateKanbanSettings,
    resetToDefault,
  };
};
