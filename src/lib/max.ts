import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type MaxNotificationType = "supply" | "invoice" | "request" | "alert" | "general";

export async function notifyMax(params: {
  organizationId: string;
  notificationType: MaxNotificationType;
  text: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke("notify-max", {
      body: {
        organization_id: params.organizationId,
        notification_type: params.notificationType,
        text: params.text,
      },
    });
    if (error) {
      console.error("notify-max error:", error);
      return false;
    }
    if ((data as any)?.ok === false) {
      console.warn("notify-max skipped:", (data as any)?.error);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("notify-max exception:", e);
    toast({ title: "Ошибка MAX", description: e?.message, variant: "destructive" });
    return false;
  }
}
