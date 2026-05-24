// Notification dispatch: thin wrapper around DB function enqueue_notification.
// Called from app code for events that are NOT covered by DB triggers (e.g. webhook errors, manual alerts).
// Also kicks the worker after enqueue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    organization_id,
    event_type,
    entity_type = null,
    entity_id = null,
    text,
    payload = {},
    dedup_suffix = null,
  } = body ?? {};

  if (!organization_id || !event_type || !text) {
    return new Response(
      JSON.stringify({ error: "organization_id, event_type and text are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await supabase.rpc("enqueue_notification", {
    _org_id: organization_id,
    _event_type: event_type,
    _entity_type: entity_type,
    _entity_id: entity_id,
    _text: text,
    _payload: payload,
    _dedup_suffix: dedup_suffix,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fire-and-forget worker kick
  supabase.functions.invoke("notification-worker", { body: {} }).catch(() => {});

  return new Response(JSON.stringify({ queued: data ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
