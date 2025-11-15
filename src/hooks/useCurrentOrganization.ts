import { useState, useEffect } from "react";

export const useCurrentOrganization = () => {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    return localStorage.getItem("currentOrganizationId");
  });

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem("currentOrganizationId", currentOrgId);
    } else {
      localStorage.removeItem("currentOrganizationId");
    }
  }, [currentOrgId]);

  return {
    currentOrgId,
    setCurrentOrgId,
  };
};
