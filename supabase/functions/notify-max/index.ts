// Send notification message to MAX group(s)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://platform-api.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendMessage(chatId: string, text: string, admin?: any) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");

  const tryRequest = async (mode: "bearer" | "query") => {
    let url = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (mode === "bearer") headers["Authorization"] = `Bearer ${token}`;
    else url += `&access_token=${token}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ text }) });
    const body = await res.text();
    console.log(`notify-max via ${mode} chat=${chatId} -> ${res.status} ${body.slice(0, 300)}`);
    return { res, body };
  };

  let r = await tryRequest("bearer");
  if (!r.res.ok && [401, 403, 404].includes(r.res.status)) r = await tryRequest("query");

  if (admin) {
    await admin.from("max_groups")
      .update({ last_api_status: r.res.status, last_api_at: new Date().toISOString() })
      .eq("group_id", chatId);
    await admin.from("max_webhook_logs").insert({
      event_type: r.res.ok ? "outgoing_ok" : "outgoing_error",
      group_id: chatId, chat_id: chatId, group_name: null,
      payload: { status: r.res.status, response: r.body.slice(0, 1000), text: text.slice(0, 500) },
    });
  }

  if (!r.res.ok) throw new Error(`MAX API ${r.res.status}: ${r.body}`);
  return r.body;
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

    // Verify user belongs to org
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

    if (group_id) query = query.eq("group_id", group_id);
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
        await sendMessage(g.group_id, text, admin);
        results.push({ group_id: g.group_id, ok: true });
      } catch (e: any) {
        results.push({ group_id: g.group_id, ok: false, error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-max error:", e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
