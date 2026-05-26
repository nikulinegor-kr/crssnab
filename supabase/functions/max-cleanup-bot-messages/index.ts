// One-off cleanup: delete all bot messages from MAX groups sent in the last 48h.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_API = "https://platform-api.max.ru";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "MAX_BOT_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Collect candidate messages from notification_queue (sent/delivered MAX msgs in 48h)
  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, provider_chat_id, provider_message_id, group_id")
    .eq("platform", "max")
    .not("provider_message_id", "is", null)
    .gte("created_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Also include last reminder message ids saved on max_groups
  const { data: groups } = await supabase
    .from("max_groups")
    .select("group_id, last_max_message_id")
    .not("last_max_message_id", "is", null);

  const targets: Array<{ chatId: string; messageId: string; source: string }> = [];
  for (const r of rows ?? []) {
    targets.push({
      chatId: String(r.provider_chat_id ?? r.group_id),
      messageId: String(r.provider_message_id),
      source: "queue",
    });
  }
  for (const g of groups ?? []) {
    targets.push({
      chatId: String(g.group_id),
      messageId: String(g.last_max_message_id),
      source: "reminder",
    });
  }

  let ok = 0;
  let failed = 0;
  const errors: Array<{ chatId: string; messageId: string; status: number; body: string }> = [];

  for (const t of targets) {
    try {
      const url = `${MAX_API}/messages?access_token=${encodeURIComponent(token)}&chat_id=${encodeURIComponent(t.chatId)}&message_id=${encodeURIComponent(t.messageId)}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        ok++;
      } else {
        failed++;
        const body = await res.text().catch(() => "");
        errors.push({ chatId: t.chatId, messageId: t.messageId, status: res.status, body: body.slice(0, 200) });
      }
    } catch (e) {
      failed++;
      errors.push({ chatId: t.chatId, messageId: t.messageId, status: 0, body: String(e).slice(0, 200) });
    }
    // small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 50));
  }

  return new Response(
    JSON.stringify({ attempted: targets.length, ok, failed, errors: errors.slice(0, 20) }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
