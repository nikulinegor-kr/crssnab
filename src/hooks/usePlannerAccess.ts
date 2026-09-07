import { useOrgMembership } from "./useOrgMembership";

/**
 * Planner rights of the current user, independent from having a CRM account:
 * - hasPlannerAccess: appears in the planner and can receive tasks
 * - canManageTasks: can create tasks, change status and see other people's tasks
 */
export const usePlannerAccess = () => {
  const { data: row, loading } = useOrgMembership();

  const isAdmin = row?.role === "owner" || row?.role === "admin";
  const active = !!row && row.is_active !== false;
  const hasPlannerAccess = active && (isAdmin || row?.planner_access === true);
  const canManageTasks =
    active && (isAdmin || (row?.planner_access === true && row?.can_manage_tasks === true));

  return { loading, isAdmin, hasPlannerAccess, canManageTasks };
};
