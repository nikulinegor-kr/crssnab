import { supabase } from "@/integrations/supabase/client";

// NOTE: Notifications are now delivered automatically via DB triggers
// → notification_queue → notification-worker (MAX + Telegram groups).
// These legacy helpers are kept for backwards compatibility but are
// silent no-ops when the legacy single-chat Telegram settings are not
// configured for the organization. We swallow errors so the new
// production pipeline isn't masked by a misleading "Telegram не настроен" toast.

export async function notifyTelegram(requestId: string, mode: "auto" | "send" | "edit" = "send") {
  try {
    const { data, error } = await supabase.functions.invoke("notify-telegram", {
      body: { requestId, mode },
    });
    if (error) {
      console.warn("[legacy notify-telegram] skipped:", error.message);
      return true;
    }
    if (data?.success === false) {
      console.warn("[legacy notify-telegram] skipped:", data.error);
      return true;
    }
    return true;
  } catch (error) {
    console.warn("[legacy notify-telegram] skipped:", error);
    return true;
  }
}

export async function notifyTelegramInvoiceChat(requestId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("notify-telegram", {
      body: { requestId, action: "send_to_invoice_chat" },
    });
    if (error) {
      console.warn("[legacy notify-telegram invoice] skipped:", error.message);
      return true;
    }
    if (data?.success === false) {
      console.warn("[legacy notify-telegram invoice] skipped:", data.error);
      return true;
    }
    return true;
  } catch (error) {
    console.warn("[legacy notify-telegram invoice] skipped:", error);
    return true;
  }
}
