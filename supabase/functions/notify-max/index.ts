// Send notification message to MAX group(s)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://platform-api.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendAttempt = {
  mode: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  status: number;
  response: string;
  ok: boolean;
  duration_ms: number;
};

async function sendMessage(chatId: string, text: string, admin?: any) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");

  // group_id MUST be string per MAX API
  const chatIdStr = String(chatId);
  const attempts: SendAttempt[] = [];

  const doFetch = async (
    mode: string,
    url: string,
    payload: any,
    authMode: "bearer" | "query" | "none",
  ): Promise<SendAttempt> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let finalUrl = url;
    if (authMode === "bearer") headers["Authorization"] = token;
    else if (authMode === "query") {
      finalUrl += (url.includes("?") ? "&" : "?") + "access_token=" + token;
    }
    const startedAt = Date.now();
    let status = 0;
    let body = "";
    try {
      const res = await fetch(finalUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      status = res.status;
      body = await res.text();
    } catch (e: any) {
      body = `FETCH_ERROR: ${e?.message || e}`;
    }
    const attempt: SendAttempt = {
      mode,
      url: finalUrl.replace(token, "***"),
      method: "POST",
      headers: { ...headers, Authorization: authMode === "bearer" ? "***" : "(none)" },
      payload,
      status,
      response: body.slice(0, 1500),
      ok: status >= 200 && status < 300,
      duration_ms: Date.now() - startedAt,
    };
    console.log(
      `notify-max [${mode}] chat=${chatIdStr} -> ${status} (${attempt.duration_ms}ms) ${body.slice(0, 200)}`,
    );
    attempts.push(attempt);
    return attempt;
  };

  // 1) NEW envelope format on platform-api.max.ru
  const envelopePayload = {
    recipient: { chat_id: chatIdStr, chat_type: "chat" },
    message: { text },
  };
  let last = await doFetch("envelope+bearer", `${MAX_API}/messages`, envelopePayload, "bearer");

  // 2) Legacy query-string format (still on platform-api.max.ru)
  if (!last.ok) {
    const legacyUrl = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatIdStr)}`;
    last = await doFetch("legacy+bearer", legacyUrl, { text }, "bearer");
  }

  // 3) Legacy with access_token query (fallback when 401/403/404)
  if (!last.ok && [401, 403, 404].includes(last.status)) {
    const legacyUrl = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatIdStr)}`;
    last = await doFetch("legacy+query", legacyUrl, { text }, "query");
  }

  if (admin) {
    try {
      await admin.from("max_groups")
        .update({ last_api_status: last.status, last_api_at: new Date().toISOString() })
        .eq("group_id", chatIdStr);
      await admin.from("max_webhook_logs").insert({
        event_type: last.ok ? "outgoing_ok" : "outgoing_error",
        group_id: chatIdStr,
        chat_id: chatIdStr,
        group_name: null,
        payload: {
          successful_mode: last.ok ? last.mode : null,
          final_status: last.status,
          final_response: last.response,
          text: text.slice(0, 500),
          attempts,
        },
      });
    } catch (e) {
      console.error("notify-max log error:", e);
    }
  }

  if (!last.ok) {
    throw new Error(`MAX API ${last.status}: ${last.response}`);
  }
  return { last, attempts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, notification_type, group_id, text } = await req.json();
    if (!organization_id || !text) {
      return new Response(JSON.stringify({ error: "organization_id and text are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: hasAccess } = await admin.rpc("user_has_org_access", {
      _user_id: claims.claims.sub, _org_id: organization_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = admin
      .from("max_groups")
      .select("group_id, group_name, notification_type")
      .eq("organization_id", organization_id)
      .eq("is_active", true);

    if (group_id) query = query.eq("group_id", String(group_id));
    else if (notification_type) query = query.eq("notification_type", notification_type);

    const { data: groups, error: gErr } = await query;
    if (gErr) throw gErr;
    if (!groups || groups.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Нет подключённых групп для этого типа" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const g of groups) {
      try {
        const r = await sendMessage(String(g.group_id), text, admin);
        results.push({
          group_id: g.group_id,
          group_name: g.group_name,
          ok: true,
          status: r.last.status,
          mode: r.last.mode,
          attempts: r.attempts,
        });
      } catch (e: any) {
        results.push({
          group_id: g.group_id,
          group_name: g.group_name,
          ok: false,
          error: e?.message,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({
      ok: okCount > 0,
      sent: okCount,
      total: results.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-max error:", e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
