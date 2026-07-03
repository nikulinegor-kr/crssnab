import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface PlannerViewAsState {
  currentUserId: string | null;
  viewedUserId: string | null;
  setViewedUserId: (id: string | null) => void;
  canSwitch: boolean;
  isSelf: boolean;
}

const Ctx = createContext<PlannerViewAsState | null>(null);

export function PlannerViewAsProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      setViewedUserId((prev) => prev ?? uid);
    });
  }, []);

  // Non-admins are forced to self.
  useEffect(() => {
    if (!isAdmin && currentUserId) setViewedUserId(currentUserId);
  }, [isAdmin, currentUserId]);

  return (
    <Ctx.Provider
      value={{
        currentUserId,
        viewedUserId,
        setViewedUserId: (id) => setViewedUserId(id ?? currentUserId),
        canSwitch: !!isAdmin,
        isSelf: viewedUserId === currentUserId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlannerViewAs(): PlannerViewAsState {
  const v = useContext(Ctx);
  if (!v) {
    return {
      currentUserId: null,
      viewedUserId: null,
      setViewedUserId: () => {},
      canSwitch: false,
      isSelf: true,
    };
  }
  return v;
}
