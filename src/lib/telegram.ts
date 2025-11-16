import { supabase } from "@/integrations/supabase/client";

export async function notifyTelegram(requestId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("notify-telegram", {
      body: { requestId },
    });

    if (error) {
      console.error("Error notifying Telegram:", error);
      return false;
    }

    console.log("Telegram notification sent:", data);
    return true;
  } catch (error) {
    console.error("Error calling notify-telegram:", error);
    return false;
  }
}
