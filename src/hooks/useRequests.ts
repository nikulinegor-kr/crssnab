import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Request {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  priority: string;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  payment_percentage: number;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export const useRequests = () => {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("request_date", { ascending: false });

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
        .select("status, payment_percentage, delivery_date, created_at");

      if (error) throw error;

      const total = data?.length || 0;
      const today = new Date().toISOString().split("T")[0];
      const newToday = data?.filter(
        (r: any) => r.created_at?.split("T")[0] === today
      ).length || 0;
      
      const emergency = data?.filter(
        (r: any) => r.status === "Аварийно"
      ).length || 0;
      
      const completed = data?.filter(
        (r: any) => r.status === "Доставлено" || r.status === "Выполнено"
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
