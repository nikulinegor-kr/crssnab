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
  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("currentOrganizationId")
      : null;

  return useQuery({
    queryKey: ["requests", showArchived, orgId],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const buildQuery = () => {
        let query = supabase
          .from("requests")
          .select("*, request_objects(id, name), equipment(id, brand, model, plate_number, vin)", { count: "exact" })
          .eq("archived", showArchived)
          .eq("is_project", false);
        if (orgId) query = query.eq("organization_id", orgId);
        return query.order("created_at", { ascending: false });
      };

      // First page also returns total count; remaining pages load in parallel.
      const first = await buildQuery().range(0, PAGE_SIZE - 1);
      if (first.error) throw first.error;
      let allData: any[] = first.data || [];
      const total = first.count ?? allData.length;

      if (total > PAGE_SIZE) {
        const pages: Promise<any>[] = [];
        for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) {
          pages.push(Promise.resolve(buildQuery().range(from, from + PAGE_SIZE - 1)));
        }
        const results = await Promise.all(pages);
        for (const r of results) {
          if (r.error) throw r.error;
          allData = allData.concat(r.data || []);
        }
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
  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("currentOrganizationId")
      : null;

  return useQuery({
    queryKey: ["request-stats", orgId],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Server-side counts only — no full-table download.
      const today = new Date().toISOString().split("T")[0];
      const base = () => {
        const q = supabase.from("requests").select("id", { count: "exact", head: true });
        return orgId ? q.eq("organization_id", orgId) : q;
      };

      const [t, n, e, c] = await Promise.all([
        base(),
        base().gte("created_at", `${today}T00:00:00Z`),
        base().eq("priority", "Аварийно"),
        base().eq("status", "Доставлено"),
      ]);
      const err = t.error || n.error || e.error || c.error;
      if (err) throw err;
      return {
        total: t.count ?? 0,
        newToday: n.count ?? 0,
        emergency: e.count ?? 0,
        completed: c.count ?? 0,
      };
    },
  });
};
