import { ReactNode, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "./AppLayout";

interface Props {
  fullBleed?: boolean;
  hideSubscriptionBanner?: boolean;
  fallback?: ReactNode;
}

/**
 * Layout route: sidebar and header stay mounted across route changes,
 * only the page content suspends.
 */
export function PersistentAppLayout({ fullBleed, hideSubscriptionBanner, fallback }: Props) {
  return (
    <ProtectedRoute>
      <AppLayout fullBleed={fullBleed} hideSubscriptionBanner={hideSubscriptionBanner}>
        <Suspense fallback={fallback ?? null}>
          <Outlet />
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default PersistentAppLayout;
