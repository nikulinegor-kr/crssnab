import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToRequestDeliveryReceipt, type DeliveryReceiptIntent } from "@/lib/requestDeliveryReceipt";
import { RequestReceiptButton } from "./RequestReceiptButton";

/** Opens the same warehouse form regardless of where the delivery status was selected. */
export function RequestDeliveryReceipt() {
  const [intent, setIntent] = useState<DeliveryReceiptIntent | null>(null);
  useEffect(() => subscribeToRequestDeliveryReceipt(setIntent), []);
  const { data, error } = useQuery({
    queryKey: ["delivery-receipt-request", intent?.requestId],
    enabled: !!intent,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("requests")
        .select("id,organization_id,request_number,description,status,shipment_date,delivery_date,actual_arrival_date")
        .eq("id", intent!.requestId).single();
      if (error) throw error;
      return data;
    },
  });

  if (!intent) return null;
  if (data) return <RequestReceiptButton key={data.id} request={data} deliveryIntent={intent} onDeliveryClose={() => setIntent(null)} />;
  return (
    <Dialog open onOpenChange={open => { if (!open) setIntent(null); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Необходимо осуществить приёмку</DialogTitle></DialogHeader>
        <p role={error ? "alert" : "status"}>{error ? error.message : "Загружаем заявку…"}</p>
      </DialogContent>
    </Dialog>
  );
}
