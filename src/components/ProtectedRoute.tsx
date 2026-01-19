import { useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  const handleSessionRefresh = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[ProtectedRoute] Session error:", error.message);
        // If token expired, try to refresh it
        if (error.message.includes('expired') || error.message.includes('Invalid')) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            console.debug("[ProtectedRoute] Token refresh failed, logging out");
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            return;
          }
          setIsAuthenticated(true);
          return;
        }
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(!!session);
      console.debug("[ProtectedRoute] getSession", { hasSession: !!session });
    } catch (err) {
      console.error("[ProtectedRoute] getSession error", err);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen for auth changes FIRST to avoid missing initial events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug("[ProtectedRoute] onAuthStateChange", { event, hasSession: !!session });
      
      // Handle token refresh events
      if (event === 'TOKEN_REFRESHED') {
        console.debug("[ProtectedRoute] Token refreshed successfully");
        setIsAuthenticated(!!session);
        setIsLoading(false);
        return;
      }
      
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Handle session expiry or errors
      if (!session && event !== 'INITIAL_SESSION') {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Then check current session
    handleSessionRefresh();

    return () => subscription.unsubscribe();
  }, [handleSessionRefresh]);

  // Add visibility change listener to refresh session when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        // Silently try to refresh session when user returns to tab
        supabase.auth.refreshSession().catch((err) => {
          console.debug("[ProtectedRoute] Background refresh failed:", err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the current location to redirect back after login
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
