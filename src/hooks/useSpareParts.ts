import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SparePartRow {
  id: string;
  organization_id: string;
  article: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  cross_numbers: string[] | null;
  equipment_type: string | null;
  equipment_model: string | null;
  unit: string | null;
  min_stock: number | null;
  storage_location: string | null;
  rack: string | null;
  shelf: string | null;
  cell: string | null;
  purchase_price: number | null;
  avg_cost: number | null;
  price: number | null;
  photos: string[] | null;
  is_archived: boolean | null;
  last_receipt_at: string | null;
  notes: string | null;
  quantity: number | null;
  stock?: number;
}

export interface Movement {
  id: string;
  spare_part_id: string;
  type: "IN" | "WRITE_OFF" | "MOVE" | "SALE" | "RETURN" | "ADJUST";
  quantity: number;
  equipment_id: string | null;
  object_id: string | null;
  responsible_user_id: string | null;
  reason: string | null;
  comment: string | null;
  unit_price: number | null;
  buyer: string | null;
  created_at: string;
  created_by: string | null;
}

export const useSparePartsList = (orgId: string | null) =>
  useQuery({
    queryKey: ["spare-parts-list", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const client = supabase as any;
      const { data: parts, error } = await client
        .from("spare_parts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;

      const ids = (parts ?? []).map((p: any) => p.id);
      if (!ids.length) return parts as SparePartRow[];

      const { data: movs } = await client
        .from("spare_part_movements")
        .select("spare_part_id, type, quantity")
        .in("spare_part_id", ids);

      const stockMap = new Map<string, number>();
      (movs ?? []).forEach((m: any) => {
        const cur = stockMap.get(m.spare_part_id) ?? 0;
        const q = Number(m.quantity) || 0;
        let d = 0;
        if (m.type === "IN" || m.type === "RETURN" || m.type === "ADJUST") d = q;
        else if (m.type === "WRITE_OFF" || m.type === "SALE") d = -q;
        stockMap.set(m.spare_part_id, cur + d);
      });

      return (parts as SparePartRow[]).map((p) => ({
        ...p,
        stock: stockMap.get(p.id) ?? 0,
      }));
    },
    enabled: !!orgId,
  });

export const useSparePartMovements = (partId: string | null) =>
  useQuery({
    queryKey: ["spare-part-movements", partId],
    queryFn: async () => {
      if (!partId) return [];
      const { data, error } = await (supabase as any)
        .from("spare_part_movements")
        .select("*, equipment:equipment_id(id, brand, model, plate_number), object:object_id(id, name), responsible:responsible_user_id(id, full_name)")
        .eq("spare_part_id", partId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!partId,
  });

export const useSparePartEquipment = (partId: string | null) =>
  useQuery({
    queryKey: ["spare-part-equipment", partId],
    queryFn: async () => {
      if (!partId) return [];
      const { data, error } = await (supabase as any)
        .from("spare_part_equipment")
        .select("equipment_id, equipment:equipment_id(id, brand, model, plate_number, year)")
        .eq("spare_part_id", partId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!partId,
  });

export const useSparePartsDeadstock = (orgId: string | null) =>
  useQuery({
    queryKey: ["spare-part-deadstock", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await (supabase as any)
        .from("spare_part_deadstock")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });
