import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";

export interface DeadstockItem {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  status: string;
  name: string;
  qty: number;
  description: string | null;
  part_number: string | null;
  price: number;
  responsible_user_id: string | null;
  sold_at: string | null;
  buyer: string | null;
  invoice_number: string | null;
  tk: string | null;
  shipped_at: string | null;
  arrived_at: string | null;
  photo_urls: string[] | null;
  document_urls: string[] | null;
}

export type DeadstockInsert = Omit<DeadstockItem, "id" | "created_at" | "updated_at" | "created_by">;
export type DeadstockUpdate = Partial<DeadstockInsert>;

export function useDeadstock(status: "active" | "archived") {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["deadstock", currentOrgId, status],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("deadstock_items")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeadstockItem[];
    },
    enabled: !!currentOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (item: DeadstockInsert) => {
      const { data, error } = await supabase
        .from("deadstock_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadstock"] });
      toast({ title: "Позиция создана" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: DeadstockUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("deadstock_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadstock"] });
      toast({ title: "Позиция обновлена" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const markSoldMutation = useMutation({
    mutationFn: async (payload: { id: string; sold_at: string; buyer: string; invoice_number: string; tk?: string; shipped_at?: string; arrived_at?: string }) => {
      const { data, error } = await supabase
        .from("deadstock_items")
        .update({
          status: "archived",
          sold_at: payload.sold_at,
          buyer: payload.buyer,
          invoice_number: payload.invoice_number,
          tk: payload.tk || null,
          shipped_at: payload.shipped_at || null,
          arrived_at: payload.arrived_at || null,
        })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadstock"] });
      toast({ title: "Позиция отмечена как проданная" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    markSold: markSoldMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isMarkingSold: markSoldMutation.isPending,
  };
}

export async function uploadDeadstockFiles(
  files: File[],
  bucket: "deadstock-photos" | "deadstock-documents",
  orgId: string
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const path = `${orgId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(urlData.publicUrl);
  }
  return urls;
}
