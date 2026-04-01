import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useUserRole } from "./useUserRole";

// All permission keys matching sidebar structure
export const ALL_PERMISSION_KEYS = [
  "crm",
  "crm.requests",
  "crm.objects",
  "project",
  "project.material_statements",
  "project.documents",
  "erp",
  "erp.nomenclature",
  "erp.warehouse",
  "erp.equipment",
  "erp.suppliers",
  "erp.shipments",
  "finance",
  "finance.budgets",
  "analytics",
  "analytics.dashboard",
  "analytics.reports",
] as const;

export type PermissionKey = typeof ALL_PERMISSION_KEYS[number];

// Tree structure for UI
export const PERMISSION_TREE = [
  {
    key: "crm" as PermissionKey,
    label: "CRM",
    children: [
      { key: "crm.requests" as PermissionKey, label: "Заявки" },
      { key: "crm.objects" as PermissionKey, label: "Объекты" },
    ],
  },
  {
    key: "project" as PermissionKey,
    label: "Проект",
    children: [
      { key: "project.material_statements" as PermissionKey, label: "Ведомости материалов" },
      { key: "project.documents" as PermissionKey, label: "Документы" },
    ],
  },
  {
    key: "erp" as PermissionKey,
    label: "ERP",
    children: [
      { key: "erp.nomenclature" as PermissionKey, label: "Номенклатура" },
      { key: "erp.warehouse" as PermissionKey, label: "Склад" },
      { key: "erp.equipment" as PermissionKey, label: "Техника" },
      { key: "erp.suppliers" as PermissionKey, label: "Поставщики" },
      { key: "erp.shipments" as PermissionKey, label: "Поставки" },
    ],
  },
  {
    key: "finance" as PermissionKey,
    label: "Финансы",
    children: [
      { key: "finance.budgets" as PermissionKey, label: "Бюджеты" },
    ],
  },
  {
    key: "analytics" as PermissionKey,
    label: "Аналитика",
    children: [
      { key: "analytics.dashboard" as PermissionKey, label: "Дашборд" },
      { key: "analytics.reports" as PermissionKey, label: "Отчёты" },
    ],
  },
];

// Map routes to permission keys
export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey> = {
  "/requests": "crm.requests",
  "/objects": "crm.objects",
  "/material-statements": "project.material_statements",
  "/documents": "project.documents",
  "/nomenclature": "erp.nomenclature",
  "/warehouse": "erp.warehouse",
  "/equipment": "erp.equipment",
  "/suppliers": "erp.suppliers",
  "/shipments": "erp.shipments",
  "/budgets": "finance.budgets",
  "/dashboard": "analytics.dashboard",
  "/agent-report": "analytics.reports",
  "/agent-act-report": "analytics.reports",
  "/percent-calculator": "analytics.reports",
};

export const useUserPermissions = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (roleLoading) return;
      
      // Admins have all permissions
      if (isAdmin) {
        const allGranted: Record<string, boolean> = {};
        ALL_PERMISSION_KEYS.forEach(k => { allGranted[k] = true; });
        setPermissions(allGranted);
        setLoading(false);
        return;
      }

      if (!currentOrgId) {
        setPermissions({});
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPermissions({});
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_permissions")
          .select("permission_key, allowed")
          .eq("user_id", user.id)
          .eq("organization_id", currentOrgId);

        if (error) {
          console.error("Error fetching permissions:", error);
          setPermissions({});
        } else {
          const perms: Record<string, boolean> = {};
          data?.forEach(row => {
            perms[row.permission_key] = row.allowed;
          });
          setPermissions(perms);
        }
      } catch (err) {
        console.error("Error fetching permissions:", err);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [currentOrgId, isAdmin, roleLoading]);

  const hasPermission = useCallback(
    (key: PermissionKey): boolean => {
      if (isAdmin) return true;
      // Check parent permission first
      const parent = key.split(".")[0];
      if (parent !== key && permissions[parent] === false) return false;
      return permissions[key] === true;
    },
    [permissions, isAdmin]
  );

  const hasRouteAccess = useCallback(
    (route: string): boolean => {
      if (isAdmin) return true;
      const key = ROUTE_PERMISSION_MAP[route];
      if (!key) return true; // Routes not in map are accessible
      return hasPermission(key);
    },
    [hasPermission, isAdmin]
  );

  return { permissions, loading, hasPermission, hasRouteAccess };
};
