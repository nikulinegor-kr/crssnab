import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export interface PlannerEquipment {
  id: string;
  brand: string;
  model: string;
  plate_number: string | null;
  vin: string | null;
  year: number | null;
  current_object_id: string | null;
  responsible_name: string | null;
}

export interface PlannerObject {
  id: string;
  name: string;
}

export const equipmentLabel = (e?: PlannerEquipment | null): string => {
  if (!e) return "";
  const main = [e.brand, e.model].filter(Boolean).join(" ").trim();
  const plate = e.plate_number ? ` · ${e.plate_number}` : "";
  return `${main || "Без названия"}${plate}`;
};

export function usePlannerEquipment() {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-equipment-full", currentOrgId],
    queryFn: async (): Promise<PlannerEquipment[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, plate_number, vin, year, current_object_id, responsible_name")
        .eq("organization_id", currentOrgId)
        .order("brand")
        .order("model");
      if (error) throw error;
      return (data ?? []) as PlannerEquipment[];
    },
    enabled: !!currentOrgId,
    staleTime: 60_000,
  });
}

export function usePlannerObjects() {
  const { currentOrgId } = useCurrentOrganization();
  return useQuery({
    queryKey: ["planner-objects-full", currentOrgId],
    queryFn: async (): Promise<PlannerObject[]> => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PlannerObject[];
    },
    enabled: !!currentOrgId,
    staleTime: 60_000,
  });
}

export function usePlannerLookups() {
  const { data: equipment = [] } = usePlannerEquipment();
  const { data: objects = [] } = usePlannerObjects();
  const equipmentMap = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment]
  );
  const objectMap = useMemo(
    () => new Map(objects.map((o) => [o.id, o])),
    [objects]
  );
  return { equipment, objects, equipmentMap, objectMap };
}
