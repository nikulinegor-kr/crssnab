import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export async function notifyTelegram(requestId: string, mode: "auto" | "send" | "edit" = "send") {
  try {
    console.log("Sending Telegram notification for request:", requestId, "mode:", mode);
    
    const { data, error } = await supabase.functions.invoke("notify-telegram", {
      body: { requestId, mode },
    });

    if (error) {
      console.error("Error notifying Telegram:", error);
      toast({
        title: "Ошибка отправки в Telegram",
        description: error.message || "Не удалось отправить уведомление",
        variant: "destructive",
      });
      return false;
    }
    
    // Handle skipped updates (when message content hasn't changed)
    if (data?.skipped) {
      console.log("Telegram notification skipped:", data.message);
      return true;
    }
    
    // Handle Telegram API errors
    if (data?.success === false) {
      console.error("Telegram API error:", data.error);
      toast({
        title: "Ошибка Telegram",
        description: data.error || "Не удалось отправить уведомление",
        variant: "destructive",
      });
      return false;
    }
    
    console.log("Telegram notification sent successfully");
    return true;

    console.log("Telegram notification sent:", data);
    return true;
  } catch (error) {
    console.error("Error calling notify-telegram:", error);
    return false;
  }
}
