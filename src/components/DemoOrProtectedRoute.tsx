import { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

interface DemoOrProtectedRouteProps {
  children: ReactNode;
}

export function DemoOrProtectedRoute({ children }: DemoOrProtectedRouteProps) {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true";

  if (isDemoMode) {
    return <>{children}</>;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
