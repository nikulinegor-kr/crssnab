// Send a message DIRECTLY to MAX API, bypassing CRM logic.
// Tries the new envelope format first, then legacy fallbacks.
// Returns full debug payload for UI inspection.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://platform-api.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const userToken = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(userToken);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { chat_id, text, organization_id, mode, buttons, request_id } = await req.json();
    if (!chat_id) {
      return new Response(JSON.stringify({ error: "chat_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build attachments (inline_keyboard) if buttons provided
    // buttons: [{ text: string, payload: string }, ...] => 1 button per row
    let attachments: any[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      const rows = buttons
        .filter((b: any) => b && typeof b.text === "string" && typeof b.payload === "string")
        .map((b: any) => [{ type: "callback", text: String(b.text).slice(0, 30), payload: String(b.payload) }]);
      if (rows.length > 0) {
        attachments = [{ type: "inline_keyboard", payload: { buttons: rows } }];
      }
    }

    const botToken = Deno.env.get("MAX_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "MAX_BOT_TOKEN is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatIdStr = String(chat_id);
    const messageText = text || "🔧 Direct MAX API test from CRSS CRM";

    const attempts: any[] = [];

    const doFetch = async (
      label: string,
      url: string,
      payload: any,
      authMode: "bearer" | "query",
    ) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let finalUrl = url;
      if (authMode === "bearer") headers["Authorization"] = botToken;
      else finalUrl += (url.includes("?") ? "&" : "?") + "access_token=" + botToken;

      const startedAt = Date.now();
      let status = 0, body = "";
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
      const a = {
        mode: label,
        endpoint: finalUrl.replace(botToken, "***"),
        request_headers: { ...headers, Authorization: authMode === "bearer" ? "***" : "(none)" },
        request_payload: payload,
        http_status: status,
        response_body: body.slice(0, 2000),
        delivered: status >= 200 && status < 300,
        duration_ms: Date.now() - startedAt,
      };
      attempts.push(a);
      console.log(`max-direct-send [${label}] chat=${chatIdStr} -> ${status} ${body.slice(0, 200)}`);
      return a;
    };

    // Pick attempts based on requested mode (default: try all)
    const wantedMode = (mode as string) || "auto";

    if (wantedMode === "envelope" || wantedMode === "auto") {
      const msg: any = { text: messageText };
      if (attachments) msg.attachments = attachments;
      const r = await doFetch(
        "envelope+bearer",
        `${MAX_API}/messages`,
        { recipient: { chat_id: chatIdStr, chat_type: "chat" }, message: msg },
        "bearer",
      );
      if (r.delivered && wantedMode === "auto") {
        return finish(r, attempts, chatIdStr, organization_id, messageText);
      }
    }

    if (wantedMode === "legacy" || wantedMode === "auto") {
      const payload: any = { text: messageText };
      if (attachments) payload.attachments = attachments;
      const r = await doFetch(
        "legacy+bearer",
        `${MAX_API}/messages?chat_id=${encodeURIComponent(chatIdStr)}`,
        payload,
        "bearer",
      );
      if (r.delivered && wantedMode === "auto") {
        return finish(r, attempts, chatIdStr, organization_id, messageText);
      }
    }

    if (wantedMode === "query" || wantedMode === "auto") {
      const payload: any = { text: messageText };
      if (attachments) payload.attachments = attachments;
      const r = await doFetch(
        "legacy+query",
        `${MAX_API}/messages?chat_id=${encodeURIComponent(chatIdStr)}`,
        payload,
        "query",
      );
      if (r.delivered && wantedMode === "auto") {
        return finish(r, attempts, chatIdStr, organization_id, messageText);
      }
    }

    const last = attempts[attempts.length - 1];

    // After a successful text send, also push attached documents (PDF etc.) to the same chat.
    if (last?.delivered && request_id) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: reqRow } = await admin
          .from("requests")
          .select("description, document_url, document_urls")
          .eq("id", request_id)
          .maybeSingle();
        const docUrls: string[] = Array.isArray((reqRow as any)?.document_urls) && (reqRow as any).document_urls.length > 0
          ? (reqRow as any).document_urls
          : ((reqRow as any)?.document_url ? [(reqRow as any).document_url] : []);
        for (const docUrl of docUrls) {
          if (!docUrl || !(docUrl.startsWith("http://") || docUrl.startsWith("https://"))) continue;
          let finalUrl = docUrl;
          let fileName = "document.pdf";
          try {
            const u = new URL(docUrl);
            const parts = u.pathname.split("/");
            fileName = decodeURIComponent(parts[parts.length - 1] || "document.pdf");
            const idx = parts.findIndex((p) => p === "request-documents");
            if (idx !== -1) {
              const filePath = parts.slice(idx + 1).join("/");
              const { data: signed } = await admin.storage
                .from("request-documents")
                .createSignedUrl(filePath, 86400);
              if (signed?.signedUrl) finalUrl = signed.signedUrl;
            }
          } catch { /* keep original */ }
          const caption = `📄 ${String((reqRow as any)?.description ?? "").slice(0, 100)}`.trim();
          const docRes = await sendMaxDocument(chatIdStr, finalUrl, fileName, caption, botToken);
          attempts.push({ mode: "document", endpoint: "uploads+messages", delivered: docRes.ok, http_status: docRes.status, response_body: docRes.body });
          console.log(`max-direct-send [document] chat=${chatIdStr} file=${fileName} -> ${docRes.status} ok=${docRes.ok}`);
        }
      } catch (e: any) {
        console.error("max-direct-send document send error:", e?.message || e);
      }
    }

    return finish(last, attempts, chatIdStr, organization_id, messageText);
  } catch (e: any) {
    console.error("max-direct-send error:", e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  async function finish(last: any, attempts: any[], chatId: string, orgId: string | undefined, text: string) {
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin.from("max_webhook_logs").insert({
        event_type: last.delivered ? "direct_send_ok" : "direct_send_error",
        group_id: chatId, chat_id: chatId, group_name: null,
        payload: {
          source: "max-direct-send",
          organization_id: orgId,
          text: text.slice(0, 500),
          attempts,
        },
      });
      if (orgId) {
        await admin.from("max_groups")
          .update({ last_api_status: last.http_status, last_api_at: new Date().toISOString() })
          .eq("group_id", chatId);
      }
    } catch (e) {
      console.error("max-direct-send log error:", e);
    }
    return new Response(JSON.stringify({
      ok: last.delivered,
      delivered: last.delivered,
      status: last.http_status,
      mode_used: last.mode,
      endpoint: last.endpoint,
      payload: last.request_payload,
      response: last.response_body,
      attempts,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
