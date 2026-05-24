// Send notification message to MAX group(s)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://botapi.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendMessage(chatId: string, text: string) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");
  const res = await fetch(
    `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}&access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`MAX API ${res.status}: ${body}`);
  return body;
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
        await sendMessage(g.group_id, text);
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
