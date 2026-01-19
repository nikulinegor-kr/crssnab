import { useEffect, useState, useCallback, useRef } from "react";
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
  const lastRefreshRef = useRef<number>(0);
  const refreshIntervalMs = 60000; // Minimum 1 minute between refreshes

  const handleSessionCheck = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[ProtectedRoute] Session error:", error.message);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(!!session);
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
      // Only log significant events to reduce console noise
      if (event !== 'TOKEN_REFRESHED') {
        console.debug("[ProtectedRoute] onAuthStateChange", { event, hasSession: !!session });
      }
      
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // For all other events, just update the state
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Then check current session
    handleSessionCheck();

    return () => subscription.unsubscribe();
  }, [handleSessionCheck]);

  // Add visibility change listener to refresh session when user returns to tab
  // with debounce to prevent excessive refreshes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        const now = Date.now();
        
        // Only refresh if enough time has passed since last refresh
        if (now - lastRefreshRef.current > refreshIntervalMs) {
          lastRefreshRef.current = now;
          
          try {
            const { error } = await supabase.auth.refreshSession();
            if (error) {
              console.debug("[ProtectedRoute] Background refresh failed:", error.message);
            }
          } catch (err) {
            // Silently ignore background refresh errors
          }
        }
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
