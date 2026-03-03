import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

export interface Procurement {
  id: string;
  organization_id: string;
  created_by: string | null;
  total_amount: number;
  status: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  creator_name?: string;
}

export interface ProcurementItem {
  id: string;
  procurement_id: string;
  request_id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  created_at: string;
}

export const useProcurements = () => {
  const { currentOrgId } = useCurrentOrganization();

  return useQuery({
    queryKey: ["procurements", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];

      const { data, error } = await supabase
        .from("procurements")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get items count and creator names
      const procurements = data as Procurement[];
      
      for (const p of procurements) {
        const { count } = await supabase
          .from("procurement_items")
          .select("*", { count: "exact", head: true })
          .eq("procurement_id", p.id);
        p.items_count = count || 0;

        if (p.created_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", p.created_by)
            .single();
          p.creator_name = profile?.full_name || profile?.email || "—";
        }
      }

      return procurements;
    },
    enabled: !!currentOrgId,
  });
};

export const useProcurementItems = (procurementId: string | null) => {
  return useQuery({
    queryKey: ["procurement-items", procurementId],
    queryFn: async () => {
      if (!procurementId) return [];

      const { data, error } = await supabase
        .from("procurement_items")
        .select("*")
        .eq("procurement_id", procurementId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ProcurementItem[];
    },
    enabled: !!procurementId,
  });
};

export const useCreateProcurement = () => {
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (items: { request_id: string; name: string; qty: number; price: number }[]) => {
      if (!currentOrgId) throw new Error("Нет организации");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      const totalAmount = items.reduce((sum, item) => sum + item.qty * item.price, 0);

      const { data: procurement, error: pError } = await supabase
        .from("procurements")
        .insert({
          organization_id: currentOrgId,
          created_by: user.id,
          total_amount: totalAmount,
          status: "draft",
          name: `Закуп от ${new Date().toLocaleDateString("ru-RU")}`,
        })
        .select()
        .single();

      if (pError) throw pError;

      const procurementItems = items.map((item) => ({
        procurement_id: procurement.id,
        request_id: item.request_id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        total: item.qty * item.price,
      }));

      const { error: iError } = await supabase
        .from("procurement_items")
        .insert(procurementItems);

      if (iError) throw iError;

      return procurement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurements"] });
    },
  });
};

export const useDeleteProcurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (procurementId: string) => {
      const { error } = await supabase
        .from("procurements")
        .delete()
        .eq("id", procurementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurements"] });
    },
  });
};