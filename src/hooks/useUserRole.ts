import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export type UserRole = "owner" | "admin" | "editor" | "viewer" | "member" | null;

export const useUserRole = () => {
  const { currentOrgId } = useCurrentOrganization();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentOrgId) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_organizations")
          .select("role")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrgId)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        } else {
          setRole(data?.role as UserRole);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [currentOrgId]);

  const canEdit = role === "owner" || role === "admin" || role === "editor";
  const canCreate = role === "owner" || role === "admin" || role === "editor";
  const isAdmin = role === "owner" || role === "admin";
  const isViewer = role === "viewer";

  return {
    role,
    loading,
    canEdit,
    canCreate,
    isAdmin,
    isViewer,
  };
};
