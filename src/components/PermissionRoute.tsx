import { Navigate, useLocation, Link } from "react-router-dom";
import { useUserPermissions, ROUTE_PERMISSION_MAP } from "@/hooks/useUserPermissions";
import { AlertTriangle, Loader2 } from "lucide-react";

interface PermissionRouteProps {
  children: React.ReactNode;
}

export const PermissionRoute = ({ children }: PermissionRouteProps) => {
  const location = useLocation();
  const { hasRouteAccess, loading } = useUserPermissions();
  const fallbackRoutes = [
    "/dashboard",
    "/requests",
    "/material-statements",
    "/documents",
    "/objects",
    "/nomenclature",
    "/warehouse",
    "/equipment",
    "/suppliers",
    "/shipments",
    "/budgets",
    "/agent-report",
    "/agent-act-report",
    "/percent-calculator",
    "/team-performance",
    "/action-log",
    "/ai-assistant",
    "/organization/settings",
  ];

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
  const firstAccessibleRoute = fallbackRoutes.find(route => hasRouteAccess(route));

  if (matchedRoute && !hasRouteAccess(matchedRoute)) {
    if (firstAccessibleRoute && firstAccessibleRoute !== path) {
      return <Navigate to={firstAccessibleRoute} replace />;
    }

    return (
      <div className="min-h-[320px] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-foreground">Нет доступа к разделу</h1>
            <p className="text-sm text-muted-foreground">
              У вашей роли нет прав для этой страницы. Откройте доступный раздел или обратитесь к администратору.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {firstAccessibleRoute ? (
              <Link
                to={firstAccessibleRoute}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Открыть доступный раздел
              </Link>
            ) : (
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                На главную
              </Link>
            )}
            <Link
              to="/organization/settings"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Настройки доступа
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
