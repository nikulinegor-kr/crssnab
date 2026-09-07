import { useOrgMembership } from "./useOrgMembership";

export type UserRole = "owner" | "admin" | "editor" | "viewer" | "member" | null;

export const useUserRole = () => {
  const { data, loading } = useOrgMembership();
  const role = (data?.role as UserRole) ?? null;

  const canEdit = role === "owner" || role === "admin" || role === "editor";
  const canCreate = canEdit;
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
