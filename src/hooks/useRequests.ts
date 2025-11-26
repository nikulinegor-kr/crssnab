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
  executor: string | null;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  amount: number;
  payment_percentage: number;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
  photo_url: string | null;
  document_url: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export const useRequests = (showArchived: boolean = false) => {
  return useQuery({
    queryKey: ["requests", showArchived],
    queryFn: async () => {
      const query = supabase
        .from("requests")
        .select("*")
        .eq("archived", showArchived);
      
      const { data, error } = await query.order("request_date", { ascending: false });

      if (error) throw error;
      return data as Request[];
    },
  });
};

export const useRequestStats = () => {
  return useQuery({
    queryKey: ["request-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("status, priority, payment_percentage, delivery_date, created_at");

      if (error) throw error;

      const total = data?.length || 0;
      const today = new Date().toISOString().split("T")[0];
      const newToday = data?.filter(
        (r: any) => r.created_at?.split("T")[0] === today
      ).length || 0;
      
      const emergency = data?.filter(
        (r: any) => r.priority === "Аварийно"
      ).length || 0;
      
      const completed = data?.filter(
        (r: any) => r.status === "Доставлено"
      ).length || 0;

      return {
        total,
        newToday,
        emergency,
        completed,
      };
    },
  });
};
