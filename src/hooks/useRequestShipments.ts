import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ShipmentStatus =
  | "Ожидает погрузки"
  | "Загружена"
  | "В пути"
  | "Прибыла"
  | "Разгружена"
  | "Завершена";

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "Ожидает погрузки",
  "Загружена",
  "В пути",
  "Прибыла",
  "Разгружена",
  "Завершена",
];

export type ShipmentMode = "carrier" | "dedicated";

export type TransportType = "auto" | "container" | "rail" | "air" | "sea";

export const TRANSPORT_TYPES: { value: TransportType; label: string; emoji: string }[] = [
  { value: "auto", label: "Автомобиль", emoji: "🚛" },
  { value: "container", label: "Контейнер", emoji: "📦" },
  { value: "rail", label: "Ж/д вагон", emoji: "🚆" },
  { value: "air", label: "Авиа", emoji: "✈️" },
  { value: "sea", label: "Море", emoji: "🚢" },
];

export interface RequestShipment {
  id: string;
  organization_id: string;
  request_id: string;
  sequence_number: number;
  transport_type: TransportType;
  shipment_mode: ShipmentMode | null;
  transport_company: string | null;
  origin_city: string | null;
  destination_city: string | null;
  vehicle_number: string | null;
  trailer_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  waybill_number: string | null;
  load_date: string | null;
  planned_arrival_date: string | null;
  actual_arrival_date: string | null;
  status: ShipmentStatus;
  comment: string | null;
  document_urls: string[];
  created_at: string;
  updated_at: string;
}

export function hasShipmentArrived(shipment: Pick<RequestShipment, "status" | "actual_arrival_date">) {
  return Boolean(shipment.actual_arrival_date) || ["Прибыла", "Разгружена", "Завершена"].includes(shipment.status);
}

export function formatShipmentRoute(shipment: Pick<RequestShipment, "origin_city" | "destination_city">) {
  const origin = shipment.origin_city?.trim();
  const destination = shipment.destination_city?.trim();
  if (origin && destination) return `${origin} → ${destination}`;
  if (origin) return `Из города: ${origin}`;
  return destination ? `В город: ${destination}` : "";
}

export interface ShipmentItem {
  id: string;
  organization_id: string;
  shipment_id: string;
  product_id: string | null;
  material_name: string;
  quantity: number | null;
  unit: string | null;
}

const sb: any = supabase;

const SHIPMENT_SELECT = "id,organization_id,request_id,sequence_number,transport_type,shipment_mode,transport_company,origin_city,destination_city,vehicle_number,trailer_number,driver_name,driver_phone,waybill_number,load_date,planned_arrival_date,actual_arrival_date,status,comment,document_urls,created_at,updated_at";
const SHIPMENT_ITEM_SELECT = "id,organization_id,shipment_id,product_id,material_name,quantity,unit";

export function useRequestShipments(requestId: string | null | undefined) {
  return useQuery({
    queryKey: ["request-shipments", requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<RequestShipment[]> => {
      const { data, error } = await sb
        .from("request_shipments")
        .select(SHIPMENT_SELECT)
        .eq("request_id", requestId)
        .order("sequence_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RequestShipment[];
    },
  });
}

export function useShipmentItems(shipmentId: string | null | undefined) {
  return useQuery({
    queryKey: ["shipment-items", shipmentId],
    enabled: !!shipmentId,
    queryFn: async (): Promise<ShipmentItem[]> => {
      const { data, error } = await sb
        .from("shipment_items")
        .select(SHIPMENT_ITEM_SELECT)
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShipmentItem[];
    },
  });
}

/** Summary by request id: { reqId: {total, delivered, inTransit, overdue} } */
export function useShipmentsSummary(requestIds: string[]) {
  const key = requestIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["shipments-summary", key],
    enabled: requestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await sb
        .from("request_shipments")
        .select("request_id,status,planned_arrival_date,actual_arrival_date")
        .in("request_id", requestIds);
      if (error) throw error;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const map: Record<string, { total: number; delivered: number; inTransit: number; overdue: number }> = {};
      for (const id of requestIds) map[id] = { total: 0, delivered: 0, inTransit: 0, overdue: 0 };
      for (const r of (data ?? []) as any[]) {
        const s = map[r.request_id] ?? (map[r.request_id] = { total: 0, delivered: 0, inTransit: 0, overdue: 0 });
        s.total += 1;
        const isDone = hasShipmentArrived(r);
        if (isDone) s.delivered += 1;
        else {
          if (r.status === "В пути" || r.status === "Загружена") s.inTransit += 1;
          if (r.planned_arrival_date) {
            const d = new Date(r.planned_arrival_date); d.setHours(0, 0, 0, 0);
            if (d < today) s.overdue += 1;
          }
        }
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function useUpsertShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RequestShipment> & { request_id: string; organization_id: string }) => {
      if (payload.id) {
        const { id, ...patch } = payload;
        const { data, error } = await sb.from("request_shipments").update(patch).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await sb
        .from("request_shipments")
        .insert({ ...payload, created_by: u.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["request-shipments", data.request_id] });
      qc.invalidateQueries({ queryKey: ["shipments-summary"] });
    },
  });
}

export function useDeleteShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; request_id: string }) => {
      const { error } = await sb.from("request_shipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["request-shipments", vars.request_id] });
      qc.invalidateQueries({ queryKey: ["shipments-summary"] });
    },
  });
}

export function useUpsertShipmentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ShipmentItem> & { shipment_id: string; organization_id: string; material_name: string }) => {
      if (payload.id) {
        const { id, ...patch } = payload;
        const { data, error } = await sb.from("shipment_items").update(patch).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await sb.from("shipment_items").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["shipment-items", data.shipment_id] });
    },
  });
}

export function useDeleteShipmentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; shipment_id: string }) => {
      const { error } = await sb.from("shipment_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["shipment-items", vars.shipment_id] });
    },
  });
}
