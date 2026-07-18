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
  /** Средняя закупочная цена по всем IN-движениям с указанной ценой */
  avg_price?: number | null;
  /** Последняя закупочная цена */
  last_price?: number | null;
  /** Дата последней закупки */
  last_purchase_at?: string | null;
  /** Кол-во учтённых закупок */
  purchase_count?: number;
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
  unit_price?: number | null;
  supplier?: string | null;
  request_id?: string | null;
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
        client
          .from("filter_element_movements")
          .select("filter_element_id, type, quantity, unit_price, created_at")
          .in("filter_element_id", ids)
          .order("created_at", { ascending: false }),
        client
          .from("filter_element_equipment")
          .select("filter_element_id, equipment:equipment_id(id, brand, model, plate_number)")
          .in("filter_element_id", ids),
      ]);

      const stockMap = new Map<string, number>();
      const priceAgg = new Map<string, { sum: number; qty: number; count: number; last?: { price: number; at: string } }>();
      (movsRes.data ?? []).forEach((m: any) => {
        const q = Number(m.quantity) || 0;
        let d = 0;
        if (m.type === "IN" || m.type === "RETURN" || m.type === "ADJUST") d = q;
        else if (m.type === "WRITE_OFF") d = -q;
        stockMap.set(m.filter_element_id, (stockMap.get(m.filter_element_id) ?? 0) + d);

        if (m.type === "IN" && m.unit_price != null && Number(m.unit_price) > 0) {
          const price = Number(m.unit_price);
          const cur = priceAgg.get(m.filter_element_id) ?? { sum: 0, qty: 0, count: 0 };
          cur.sum += price * q;
          cur.qty += q;
          cur.count += 1;
          // movements are ordered DESC, so first seen = latest
          if (!cur.last) cur.last = { price, at: m.created_at };
          priceAgg.set(m.filter_element_id, cur);
        }
      });

      const eqMap = new Map<string, FilterElementRow["equipment"]>();
      (compatRes.data ?? []).forEach((r: any) => {
        const arr = eqMap.get(r.filter_element_id) ?? [];
        if (r.equipment) arr!.push(r.equipment);
        eqMap.set(r.filter_element_id, arr);
      });

      return items.map((r) => {
        const agg = priceAgg.get(r.id);
        return {
          ...r,
          stock: stockMap.get(r.id) ?? 0,
          equipment: eqMap.get(r.id) ?? [],
          avg_price: agg && agg.qty > 0 ? agg.sum / agg.qty : null,
          last_price: agg?.last?.price ?? null,
          last_purchase_at: agg?.last?.at ?? null,
          purchase_count: agg?.count ?? 0,
        };
      });
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
