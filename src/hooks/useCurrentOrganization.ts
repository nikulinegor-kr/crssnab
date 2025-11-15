import { useState } from "react";

export const useCurrentOrganization = () => {
  const [currentOrgId, _setCurrentOrgId] = useState<string | null>(() => {
    return localStorage.getItem("currentOrganizationId");
  });

  // Синхронно сохраняем выбор, чтобы избежать гонок при навигации
  const setCurrentOrgId = (id: string | null) => {
    if (id) {
      localStorage.setItem("currentOrganizationId", id);
    } else {
      localStorage.removeItem("currentOrganizationId");
    }
    _setCurrentOrgId(id);
  };

  return {
    currentOrgId,
    setCurrentOrgId,
  };
};
