import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { resolveLegacyRoute } from "@/lib/legacyRoutes";

export function LegacyRouteRedirect() {
  const location = useLocation();
  const { currentOrgId } = useCurrentOrganization();
  const { hasRouteAccess, loading } = useUserPermissions();
  const currentUrl = `${location.pathname}${location.search}${location.hash}`;

  if (!currentOrgId) {
    return <Navigate to={`/select-organization?next=${encodeURIComponent(currentUrl)}`} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Открываем рабочий раздел">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={resolveLegacyRoute(location.pathname, location.search, hasRouteAccess)} replace />;
}
