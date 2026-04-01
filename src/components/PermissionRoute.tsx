import { Navigate, useLocation } from "react-router-dom";
import { useUserPermissions, ROUTE_PERMISSION_MAP } from "@/hooks/useUserPermissions";
import { Loader2 } from "lucide-react";

interface PermissionRouteProps {
  children: React.ReactNode;
}

export const PermissionRoute = ({ children }: PermissionRouteProps) => {
  const location = useLocation();
  const { hasRouteAccess, loading } = useUserPermissions();

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Find matching route key (handle dynamic segments like /requests/:id)
  const path = location.pathname;
  const matchedRoute = Object.keys(ROUTE_PERMISSION_MAP).find(route => path === route || path.startsWith(route + "/"));

  if (matchedRoute && !hasRouteAccess(matchedRoute)) {
    return <Navigate to="/requests" replace />;
  }

  return <>{children}</>;
};
