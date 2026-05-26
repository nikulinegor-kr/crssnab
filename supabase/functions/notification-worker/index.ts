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
const BACKOFF = [30, 120, 600];

type Button = { id?: string; name: string; data?: string };

type QueueRow = {
  id: string;
  organization_id: string;
  entity_type?: string | null;
  entity_id?: string | null;
  platform: "max" | "telegram";
  group_id: string;
  payload: { text: string; buttons?: Button[]; request_id?: string; kind?: string; [k: string]: any };
  retry_count: number;
};

type SendResult = {
  ok: boolean;
  status: number;
  body: string;
  message_id?: string | number | null;
};

function buildCallbackData(requestId: string | undefined, btn: Button): string {
  if (btn.data) return btn.data;
  return `assign:${requestId ?? ""}:${btn.id ?? ""}`;
}

function buildTgKeyboard(requestId: string | undefined, buttons: Button[]) {
  const rows: any[] = [];
  for (const btn of buttons) {
    rows.push([
      { text: btn.name.slice(0, 30), callback_data: buildCallbackData(requestId, btn) },
    ]);
  }
  return { inline_keyboard: rows };
}

function buildMaxAttachments(requestId: string | undefined, buttons: Button[]) {
  const rows: any[] = [];
  for (const btn of buttons) {
    rows.push([
      { type: "callback", text: btn.name.slice(0, 30), payload: buildCallbackData(requestId, btn) },
    ]);
  }
  return [{ type: "inline_keyboard", payload: { buttons: rows } }];
}

async function sendMax(chatId: string, text: string, attachments?: any): Promise<SendResult> {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return { ok: false, status: 0, body: "MAX_BOT_TOKEN not configured" };
  const url = `${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`;
  const body: any = { text };
  if (attachments) body.attachments = attachments;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const respBody = await res.text();
  let messageId: string | number | null = null;
  try {
    const j = JSON.parse(respBody);
    messageId = j?.message?.body?.mid ?? j?.message?.mid ?? j?.message_id ?? null;
  } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body: respBody.slice(0, 1500), message_id: messageId };
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMaxDocument(chatId: string, fileUrl: string, fileName: string, caption: string): Promise<SendResult> {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return { ok: false, status: 0, body: "MAX_BOT_TOKEN not configured" };
  try {
    // Step 1: get upload URL
    const uploadInitRes = await fetch(`${MAX_API}/uploads?type=file`, {
      method: "POST",
      headers: { Authorization: token },
    });
    const uploadInitBody = await uploadInitRes.text();
    if (!uploadInitRes.ok) {
      return { ok: false, status: uploadInitRes.status, body: `uploads init failed: ${uploadInitBody.slice(0, 500)}` };
    }
    const uploadInit = JSON.parse(uploadInitBody);
    const uploadUrl: string | undefined = uploadInit?.url;
    const initToken: string | undefined = uploadInit?.token ?? uploadInit?.file?.token ?? uploadInit?.payload?.token;
    if (!uploadUrl) return { ok: false, status: 0, body: `no upload url: ${uploadInitBody.slice(0, 300)}` };

    // Step 2: download source file then upload as multipart form-data using field `data`
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return { ok: false, status: fileRes.status, body: `source fetch failed` };
    const fileBlob = await fileRes.blob();
    const form = new FormData();
    form.append("data", fileBlob, fileName);
    const upRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { Accept: "application/json; charset=utf-8" },
      body: form,
    });
    const upBody = await upRes.text();
    if (!upRes.ok) return { ok: false, status: upRes.status, body: `upload failed: ${upBody.slice(0, 500)}` };
    let fileToken: string | undefined = initToken;
    try {
      const upJson = JSON.parse(upBody);
      fileToken = fileToken ?? upJson?.token ?? upJson?.file?.token ?? upJson?.payload?.token;
    } catch { /* ignore */ }
    if (!fileToken) return { ok: false, status: 0, body: `no file token: ${upBody.slice(0, 300)}` };

    // Step 3: send message with file attachment, retry while MAX is still processing the upload
    const retryDelays = [0, 2000, 4000, 7000];
    let lastStatus = 0;
    let lastBody = "";
    for (const retryDelay of retryDelays) {
      if (retryDelay > 0) await delay(retryDelay);
      const msgRes = await fetch(`${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({
          text: caption,
          attachments: [{ type: "file", payload: { token: fileToken } }],
        }),
      });
      const msgBody = await msgRes.text();
      lastStatus = msgRes.status;
      lastBody = msgBody;

      let parsed: any = null;
      try {
        parsed = JSON.parse(msgBody);
      } catch { /* ignore */ }

      const code = parsed?.code ?? parsed?.error?.code ?? null;
      const messageId = parsed?.message?.body?.mid ?? parsed?.message?.mid ?? parsed?.message_id ?? null;
      if (msgRes.ok && code !== "attachment.not.ready") {
        return { ok: true, status: msgRes.status, body: msgBody.slice(0, 1000), message_id: messageId };
      }
      if (code !== "attachment.not.ready") {
        return { ok: false, status: msgRes.status, body: msgBody.slice(0, 1000), message_id: messageId };
      }
    }

    return { ok: false, status: lastStatus, body: lastBody.slice(0, 1000) };
  } catch (e: any) {
    return { ok: false, status: 0, body: `EXCEPTION: ${e?.message || e}` };
  }
}

async function sendTelegram(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: any,
): Promise<SendResult> {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const res = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const respBody = await res.text();
  let messageId: number | null = null;
  try {
    const j = JSON.parse(respBody);
    messageId = j?.result?.message_id ?? null;
  } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body: respBody.slice(0, 1500), message_id: messageId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, organization_id, entity_type, entity_id, platform, group_id, payload, retry_count")
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

  await supabase
    .from("notification_queue")
    .update({ status: "sending" })
    .in("id", items.map((i) => i.id));

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

  // Sanitizer: strip internal CRM identifiers (#REQ-..., bare # lines) before sending to external platforms
  const removeInternalIds = (s: string): string =>
    s
      .replace(/^\s*#REQ-[\w-]+\s*$/gim, "")          // bare "#REQ-..." lines
      .replace(/#REQ-[\w-]+/gi, "")                     // inline "#REQ-..." tokens
      .replace(/\n{3,}/g, "\n\n")                       // collapse blank lines
      .trim();

  for (const row of items) {
    const rawText = String(row.payload?.text ?? "");
    const text = removeInternalIds(rawText);
    const buttons = Array.isArray(row.payload?.buttons) ? (row.payload!.buttons as Button[]) : [];
    const requestId = typeof row.payload?.request_id === "string" && row.payload.request_id
      ? row.payload.request_id
      : (row.entity_type === "request" && row.entity_id ? row.entity_id : undefined);

    let result: SendResult;
    try {
      if (row.platform === "max") {
        const attachments = buttons.length > 0 && requestId
          ? buildMaxAttachments(requestId, buttons)
          : undefined;
        result = await sendMax(row.group_id, text, attachments);
      } else {
        const tok = await getTgToken(row.organization_id);
        if (!tok) {
          result = { ok: false, status: 0, body: "telegram bot_token not configured for org" };
        } else {
          const markup = buttons.length > 0 && requestId
            ? buildTgKeyboard(requestId, buttons)
            : undefined;
          result = await sendTelegram(tok, row.group_id, text, markup);
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
          provider_message_id: result.message_id ? String(result.message_id) : null,
          provider_chat_id: row.group_id,
        })
        .eq("id", row.id);

      // Send attached documents (PDF etc.) as files after the text message.
      if (requestId) {
        try {
          const { data: reqRow } = await supabase
            .from("requests")
            .select("description, document_url, document_urls")
            .eq("id", requestId)
            .maybeSingle();
          const docUrls: string[] = Array.isArray((reqRow as any)?.document_urls) && (reqRow as any).document_urls.length > 0
            ? (reqRow as any).document_urls
            : ((reqRow as any)?.document_url ? [(reqRow as any).document_url] : []);
          if (docUrls.length > 0) {
            const tgTok = row.platform === "telegram" ? await getTgToken(row.organization_id) : null;
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
                  const { data: signed } = await supabase.storage
                    .from("request-documents")
                    .createSignedUrl(filePath, 86400);
                  if (signed?.signedUrl) finalUrl = signed.signedUrl;
                }
              } catch { /* keep original */ }
              const caption = `📄 ${String((reqRow as any)?.description ?? "").slice(0, 100)}`.trim();

              if (row.platform === "telegram" && tgTok) {
                try {
                  const res = await fetch(`${TG_API}/bot${tgTok}/sendDocument`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: row.group_id, document: finalUrl, caption }),
                  });
                  if (!res.ok) {
                    console.error("[notification-worker] TG sendDocument failed", res.status, await res.text());
                  }
                } catch (e) {
                  console.error("[notification-worker] TG sendDocument exception", e);
                }
              } else if (row.platform === "max") {
                const r = await sendMaxDocument(row.group_id, finalUrl, fileName, caption);
                if (!r.ok) {
                  console.error("[notification-worker] MAX sendDocument failed", r.status, r.body);
                }
              }
            }
          }
        } catch (e) {
          console.error("[notification-worker] doc fetch error", e);
        }
      }
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
