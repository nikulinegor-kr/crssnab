// Notification health check: pings MAX and Telegram APIs, updates notification_health table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function check(url: string, init?: RequestInit) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, init);
    const text = await r.text();
    return {
      status: r.ok ? "ok" : "degraded",
      latency_ms: Date.now() - t0,
      last_error: r.ok ? null : `${r.status} ${text.slice(0, 200)}`,
    };
  } catch (e: any) {
    return {
      status: "down" as const,
      latency_ms: Date.now() - t0,
      last_error: String(e?.message || e).slice(0, 200),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let orgId: string | null = null;
  try {
    const body = await req.json();
    orgId = body?.organization_id ?? null;
  } catch {/* cron call has no body */}

  const maxToken = Deno.env.get("MAX_BOT_TOKEN");
  const maxRes = maxToken
    ? await check(`https://platform-api.max.ru/me?access_token=${maxToken}`)
    : { status: "unknown" as const, latency_ms: 0, last_error: "MAX_BOT_TOKEN missing" };

  // Telegram: use first configured org bot token, or env
  let tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (orgId) {
    const { data } = await supabase
      .from("telegram_settings").select("bot_token").eq("organization_id", orgId).maybeSingle();
    if (data?.bot_token) tgToken = data.bot_token;
  }
  const tgRes = tgToken
    ? await check(`https://api.telegram.org/bot${tgToken}/getMe`)
    : { status: "unknown" as const, latency_ms: 0, last_error: "TELEGRAM_BOT_TOKEN missing" };

  const edgeRes = { status: "ok" as const, latency_ms: 0, last_error: null };

  const rows = [
    { component: "max_api", ...maxRes },
    { component: "telegram_api", ...tgRes },
    { component: "edge_functions", ...edgeRes },
  ];

  for (const row of rows) {
    await supabase.from("notification_health").upsert(
      { organization_id: orgId, ...row, last_check_at: new Date().toISOString() },
      { onConflict: "organization_id,component" },
    );
  }

  return new Response(JSON.stringify({ ok: true, components: rows }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
