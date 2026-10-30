import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export function useTaskHubIdentity() {
  const { isAdmin } = useUserRole();
  const user = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => { const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user?.id ?? null; },
    staleTime: 60_000,
  });
  return { userId: user.data ?? null, isAdmin, loading: user.isLoading };
}