// Notification worker: drains notification_queue, sends to MAX / Telegram, retries with backoff.
// Invoked by cron every minute AND directly by notify-dispatch after enqueue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_API = "https://platform-api.max.ru";
const TG_API = "https://api.telegram.org";
const BATCH = 20;
// retry backoff (seconds): 30s, 2m, 10m
const BACKOFF = [30, 120, 600];

type QueueRow = {
  id: string;
  organization_id: string;
  platform: "max" | "telegram";
  group_id: string;
  payload: { text: string; [k: string]: any };
  retry_count: number;
};

async function sendMax(chatId: string, text: string) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return { ok: false, status: 0, body: "MAX_BOT_TOKEN not configured" };
  // legacy+bearer works per recent logs
  const url = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 1500) };
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const res = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 1500) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Claim a batch: simple approach since queue volume is low.
  // Get queued rows ready for send.
  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, organization_id, platform, group_id, payload, retry_count")
    .in("status", ["queued"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (rows ?? []) as QueueRow[];
  if (items.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark as sending
  await supabase
    .from("notification_queue")
    .update({ status: "sending" })
    .in("id", items.map((i) => i.id));

  // Cache tg tokens per org
  const tgTokenCache = new Map<string, string | null>();
  async function getTgToken(orgId: string): Promise<string | null> {
    if (tgTokenCache.has(orgId)) return tgTokenCache.get(orgId)!;
    const { data } = await supabase
      .from("telegram_settings")
      .select("bot_token")
      .eq("organization_id", orgId)
      .maybeSingle();
    const tok = data?.bot_token ?? null;
    tgTokenCache.set(orgId, tok);
    return tok;
  }

  let delivered = 0;
  let failed = 0;

  for (const row of items) {
    const text = String(row.payload?.text ?? "");
    let result: { ok: boolean; status: number; body: string };
    try {
      if (row.platform === "max") {
        result = await sendMax(row.group_id, text);
      } else {
        const tok = await getTgToken(row.organization_id);
        if (!tok) {
          result = { ok: false, status: 0, body: "telegram bot_token not configured for org" };
        } else {
          result = await sendTelegram(tok, row.group_id, text);
        }
      }
    } catch (e: any) {
      result = { ok: false, status: 0, body: `EXCEPTION: ${e?.message || e}` };
    }

    if (result.ok) {
      delivered++;
      await supabase
        .from("notification_queue")
        .update({
          status: "delivered",
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
          last_http_code: result.status,
          last_response: result.body,
          last_error: null,
        })
        .eq("id", row.id);
    } else {
      failed++;
      const nextRetry = row.retry_count + 1;
      const isLast = nextRetry >= BACKOFF.length;
      const delay = BACKOFF[Math.min(row.retry_count, BACKOFF.length - 1)];
      await supabase
        .from("notification_queue")
        .update({
          status: isLast ? "failed" : "queued",
          retry_count: nextRetry,
          last_http_code: result.status,
          last_response: result.body,
          last_error: result.body.slice(0, 500),
          next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return new Response(
    JSON.stringify({ processed: items.length, delivered, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
