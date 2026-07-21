import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Request {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  priority: string;
  applicant: string | null;
  applicant_user_id: string | null;
  executor: string | null;
  object_id: string | null;
  estimated_delivery_days: number | null;
  order_days: number | null;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  amount: number;
  payment_percentage: number;
  payment_percent: number;
  payment_status: string;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
  photo_url: string | null;
  document_url: string | null;
  photo_urls: string[] | null;
  document_urls: string[] | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  received_by?: string | null;
}

export const useRequests = (showArchived: boolean = false) => {
  return useQuery({
    queryKey: ["requests", showArchived],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("requests")
          .select("*, request_objects(id, name), equipment(id, brand, model, plate_number, vin)")
          .eq("archived", showArchived)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData.map((r: any) => ({
        ...r,
        object_name: r.request_objects?.name || null,
        equipment_display: r.equipment
          ? [r.equipment.brand, r.equipment.model].filter(Boolean).join(" ")
          : null,
        equipment_plate: r.equipment?.plate_number || null,
      })) as (Request & { object_name: string | null; equipment_display: string | null; equipment_plate: string | null })[];
    },
  });
};

export const useRequestStats = () => {
  return useQuery({
    queryKey: ["request-stats"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("requests")
          .select("status, priority, payment_percentage, delivery_date, created_at")
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const total = allData.length;
      const today = new Date().toISOString().split("T")[0];
      const newToday = allData.filter(
        (r: any) => r.created_at?.split("T")[0] === today
      ).length;
      
      const emergency = allData.filter(
        (r: any) => r.priority === "Аварийно"
      ).length;
      
      const completed = allData.filter(
        (r: any) => r.status === "Доставлено"
      ).length;

      return {
        total,
        newToday,
        emergency,
        completed,
      };
    },
  });
};
