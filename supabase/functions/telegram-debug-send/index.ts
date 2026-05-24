import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function logEvent(eventType: string, groupId: string | null, payload: unknown, groupName: string | null = null) {
  try {
    await supabase.from("telegram_webhook_logs").insert({
      event_type: eventType,
      group_id: groupId,
      chat_id: groupId,
      group_name: groupName,
      payload: payload as any,
    });
  } catch (_) { /* noop */ }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organization_id, chat_id, text } = await req.json();
    if (!organization_id || !chat_id) {
      return new Response(JSON.stringify({ ok: false, error: "organization_id и chat_id обязательны" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("telegram_settings")
      .select("bot_token")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const botToken = settings?.bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ ok: false, error: "Telegram bot token не настроен" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text: text || "🔔 Тестовое уведомление CRSS CRM", parse_mode: "HTML" }),
    });
    const tgJson = await tgResp.json().catch(() => ({}));
    const ok = tgResp.ok && tgJson.ok !== false;

    // Update group status
    await supabase.from("telegram_groups").update({
      last_api_status: tgResp.status,
      last_api_at: new Date().toISOString(),
    }).eq("organization_id", organization_id).eq("group_id", String(chat_id));

    await logEvent(ok ? "outgoing_ok" : "outgoing_error", String(chat_id),
      { status: tgResp.status, response: tgJson }, null);

    return new Response(JSON.stringify({ ok, status: tgResp.status, response: tgJson }), {
      status: ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
