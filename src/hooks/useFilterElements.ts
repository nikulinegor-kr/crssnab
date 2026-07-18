import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterElementRow {
  id: string;
  organization_id: string;
  manufacturer: string | null;
  name: string;
  article: string | null;
  cross_numbers: string[] | null;
  unit: string;
  storage_location: string | null;
  min_stock: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stock?: number;
  equipment?: Array<{ id: string; brand: string | null; model: string | null; plate_number: string | null }>;
}

export interface FilterElementMovement {
  id: string;
  filter_element_id: string;
  type: "IN" | "WRITE_OFF" | "ADJUST" | "RETURN";
  quantity: number;
  equipment_id: string | null;
  responsible_user_id: string | null;
  object_id: string | null;
  comment: string | null;
  created_at: string;
  created_by: string | null;
}

export const useFilterElementsList = (orgId: string | null) =>
  useQuery({
    queryKey: ["filter-elements-list", orgId],
    queryFn: async () => {
      if (!orgId) return [] as FilterElementRow[];
      const client = supabase as any;
      const { data: rows, error } = await client
        .from("filter_elements")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      const items = (rows ?? []) as FilterElementRow[];
      const ids = items.map((r) => r.id);
      if (!ids.length) return items;

      const [movsRes, compatRes] = await Promise.all([
        client.from("filter_element_movements").select("filter_element_id, type, quantity").in("filter_element_id", ids),
        client
          .from("filter_element_equipment")
          .select("filter_element_id, equipment:equipment_id(id, brand, model, plate_number)")
          .in("filter_element_id", ids),
      ]);

      const stockMap = new Map<string, number>();
      (movsRes.data ?? []).forEach((m: any) => {
        const q = Number(m.quantity) || 0;
        let d = 0;
        if (m.type === "IN" || m.type === "RETURN" || m.type === "ADJUST") d = q;
        else if (m.type === "WRITE_OFF") d = -q;
        stockMap.set(m.filter_element_id, (stockMap.get(m.filter_element_id) ?? 0) + d);
      });

      const eqMap = new Map<string, FilterElementRow["equipment"]>();
      (compatRes.data ?? []).forEach((r: any) => {
        const arr = eqMap.get(r.filter_element_id) ?? [];
        if (r.equipment) arr!.push(r.equipment);
        eqMap.set(r.filter_element_id, arr);
      });

      return items.map((r) => ({
        ...r,
        stock: stockMap.get(r.id) ?? 0,
        equipment: eqMap.get(r.id) ?? [],
      }));
    },
    enabled: !!orgId,
  });

export const useFilterElementMovements = (id: string | null) =>
  useQuery({
    queryKey: ["filter-element-movements", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await (supabase as any)
        .from("filter_element_movements")
        .select(
          "*, equipment:equipment_id(id, brand, model, plate_number), object:object_id(id, name), responsible:responsible_user_id(id, full_name)"
        )
        .eq("filter_element_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

export const useFilterElementsDeadstock = (orgId: string | null) =>
  useQuery({
    queryKey: ["filter-element-deadstock", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from("filter_element_deadstock")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });
