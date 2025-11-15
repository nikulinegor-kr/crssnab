import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Listen for auth changes FIRST to avoid missing initial events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
      console.debug("[ProtectedRoute] onAuthStateChange", { hasSession: !!session });
    });

    // Then check current session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
        setIsLoading(false);
        console.debug("[ProtectedRoute] getSession", { hasSession: !!session });
      })
      .catch((err) => {
        console.error("[ProtectedRoute] getSession error", err);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
