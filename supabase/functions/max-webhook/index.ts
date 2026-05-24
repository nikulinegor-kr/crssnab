// MAX Bot webhook — receives updates from platform-api.max.ru
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://platform-api.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupaClient = ReturnType<typeof createClient>;
let LAST_AUTH_MODE: "bearer" | "query" = "bearer";

async function maxFetch(
  path: string,
  init?: RequestInit,
  supabase?: SupaClient,
  ctx?: { chatId?: string | null },
) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");

  const tryRequest = async (mode: "bearer" | "query") => {
    let url = `${MAX_API}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (mode === "bearer") {
      headers["Authorization"] = token;
    } else {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}access_token=${token}`;
    }
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return { res, text, data };
  };

  const order: ("bearer" | "query")[] =
    LAST_AUTH_MODE === "bearer" ? ["bearer", "query"] : ["query", "bearer"];

  let last: { res: Response; text: string; data: any } | null = null;
  for (const mode of order) {
    const r = await tryRequest(mode);
    last = r;
    console.log(`MAX API ${init?.method || "GET"} ${path} via ${mode} -> ${r.res.status} ${r.text.slice(0, 500)}`);

    if (supabase) {
      await supabase.from("max_webhook_logs").insert({
        event_type: `api_response:${mode}`,
        group_id: ctx?.chatId || null,
        chat_id: ctx?.chatId || null,
        group_name: null,
        payload: { path, method: init?.method || "GET", status: r.res.status, response: r.data },
      });

      if (ctx?.chatId) {
        await supabase
          .from("max_groups")
          .update({ last_api_status: r.res.status, last_api_at: new Date().toISOString() })
          .eq("group_id", String(ctx.chatId));
      }
    }

    if (r.res.ok) {
      LAST_AUTH_MODE = mode;
      return r.data;
    }
    if (![401, 403, 404].includes(r.res.status)) break;
  }
  throw new Error(`MAX API ${last?.res.status}: ${last?.text}`);
}

async function sendMessage(chatId: string | number, text: string, supabase?: SupaClient) {
  return maxFetch(
    `/messages?chat_id=${chatId}`,
    { method: "POST", body: JSON.stringify({ text }) },
    supabase,
    { chatId: String(chatId) },
  );
}

async function fetchChatTitle(chatId: string | number, supabase?: SupaClient): Promise<string | null> {
  try {
    const data = await maxFetch(`/chats/${chatId}`, undefined, supabase, { chatId: String(chatId) });
    return data?.title ?? null;
  } catch (_) {
    return null;
  }
}

// Auto-discover or update a group row by group_id
async function upsertDiscoveredGroup(
  supabase: SupaClient,
  chatId: string,
  groupName: string | null,
  chatType: string | null,
) {
  const { data: existing } = await supabase
    .from("max_groups")
    .select("id, group_name, chat_type")
    .eq("group_id", chatId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (!existing) {
    await supabase.from("max_groups").insert({
      group_id: chatId,
      group_name: groupName || `Группа ${chatId}`,
      chat_type: chatType,
      notification_type: "supply",
      is_active: true,
      is_discovered: true,
      last_message_at: nowIso,
      organization_id: null,
    });
    return;
  }

  const patch: Record<string, unknown> = { last_message_at: nowIso };
  if (groupName && groupName !== existing.group_name) patch.group_name = groupName;
  if (chatType && chatType !== existing.chat_type) patch.chat_type = chatType;
  await supabase.from("max_groups").update(patch).eq("id", existing.id);
}

Deno.serve(async (req) => {
  // Log EVERY incoming request immediately, before anything else
  const url = new URL(req.url);
  console.log(`[max-webhook] ${req.method} ${url.pathname}${url.search} from ${req.headers.get("user-agent") || "?"}`);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // GET /ping — simple liveness probe
  if (req.method === "GET" && (url.pathname.endsWith("/ping") || url.pathname === "/max-webhook")) {
    return new Response("OK MAX WEBHOOK", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // GET /debug-send?chat_id=...&text=... — force-send a message bypassing webhook
  if (req.method === "GET" && (url.pathname.endsWith("/debug-send") || url.pathname.endsWith("/test-max"))) {
    const chatId = url.searchParams.get("chat_id") || url.searchParams.get("group_id");
    const text = url.searchParams.get("text") || "✅ Принудительная отправка из debug-send (CRSS CRM)";
    if (!chatId) {
      return new Response(JSON.stringify({ ok: false, error: "chat_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const result = await sendMessage(chatId, text, supabase);
      console.log(`[debug-send] success chat=${chatId} auth=${LAST_AUTH_MODE}`);
      return new Response(JSON.stringify({ ok: true, auth_mode: LAST_AUTH_MODE, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error(`[debug-send] failed chat=${chatId}: ${e?.message}`);
      return new Response(JSON.stringify({ ok: false, auth_mode: LAST_AUTH_MODE, error: e?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // MAX webhook verification challenge (some platforms expect echo of a token in GET)
  if (req.method === "GET") {
    const challenge = url.searchParams.get("challenge") || url.searchParams.get("hub.challenge");
    if (challenge) {
      console.log(`[max-webhook] challenge echo: ${challenge}`);
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
    }
    return new Response("OK MAX WEBHOOK", {
      status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }


  try {
    const update = await req.json();
    console.log("MAX update (raw):", JSON.stringify(update));

    await supabase.from("max_webhook_logs").insert({
      event_type: "incoming_raw",
      group_id: null, chat_id: null, group_name: null,
      payload: update,
    });

    const updates = Array.isArray(update?.updates) ? update.updates : [update];

    for (const u of updates) {
      const updateId = u?.update_id ?? u?.timestamp ?? Date.now();
      const type = u?.update_type || u?.type || "unknown";
      const msgPre = u?.message || {};
      const chatIdRaw =
        u?.chat_id ?? msgPre?.recipient?.chat_id ?? msgPre?.chat?.id ?? u?.chat?.id ?? "";
      const chatIdStr = chatIdRaw ? String(chatIdRaw) : "";
      const chatType: string =
        msgPre?.recipient?.chat_type ?? u?.chat_type ?? u?.chat?.type ?? "unknown";

      // ---- Inline-button callback: executor assignment ----
      const callbackPayload: string | undefined =
        u?.callback?.payload ?? u?.payload ?? u?.message_callback?.payload;
      if (type === "message_callback" || (typeof callbackPayload === "string" && callbackPayload.startsWith("assign:"))) {
        if (typeof callbackPayload === "string" && callbackPayload.startsWith("assign:")) {
          const [, reqId, execId] = callbackPayload.split(":");
          const callbackId: string | undefined = u?.callback?.callback_id ?? u?.callback_id;
          const messageId: string | number | undefined =
            msgPre?.body?.mid ?? msgPre?.mid ?? u?.callback?.message?.body?.mid ?? u?.callback?.message?.mid;
          if (reqId && execId) {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/assign-executor`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                request_id: reqId,
                executor_id: execId,
                source: "max",
                chat_id: chatIdStr,
                message_id: messageId ?? "",
                callback_id: callbackId,
                user: u?.callback?.user || u?.user || null,
              }),
            }).catch((e) => console.error("assign-executor (max) failed:", e));
          }
          continue;
        }
      }

      let groupTitle: string | null = null;
      if (chatIdStr) groupTitle = await fetchChatTitle(chatIdStr, supabase);

      await supabase.from("max_webhook_logs").insert({
        event_type: type,
        group_id: chatIdStr || null,
        chat_id: chatIdStr || null,
        group_name: groupTitle,
        payload: u,
      });

      // Auto-discover / update the group row on any chat event
      if (chatIdStr) {
        await upsertDiscoveredGroup(supabase, chatIdStr, groupTitle, chatType);
      }


      // Deduplication
      const { data: existing } = await supabase
        .from("max_updates")
        .select("update_id")
        .eq("update_id", updateId)
        .maybeSingle();
      if (existing) continue;

      await supabase.from("max_updates").insert({
        update_id: updateId, chat_id: chatIdStr, payload: u,
      });

      if (type === "bot_added" || type === "chat_title_changed") {
        if (chatIdStr) {
          const title = groupTitle || `Чат ${chatIdStr}`;
          await sendMessage(
            chatIdStr,
            `Бот снабжения CRSS подключён к группе «${title}». ID группы: ${chatIdStr}\nГруппа уже появилась в настройках CRM — привяжите её к организации.`,
            supabase,
          );
        }
        continue;
      }

      const text: string = (msgPre?.body?.text || msgPre?.text || "").trim();
      if (!chatIdStr || !text) continue;

      if (text.startsWith("/start")) {
        await sendMessage(chatIdStr, "Бот снабжения активирован ✅", supabase);
        const title = groupTitle || `Чат ${chatIdStr}`;
        await sendMessage(chatIdStr, `ID этой группы: ${chatIdStr}\nНазвание: ${title}\nГруппа уже видна в настройках CRM CRSS.`, supabase);
      } else if (text.startsWith("/help")) {
        await sendMessage(
          chatIdStr,
          [
            "Команды бота снабжения CRSS:",
            "",
            "/start — активация бота",
            "/help — список команд",
            "/id — debug-информация о текущей группе",
            "",
            "Бот отправляет уведомления:",
            "• приход и перемещение груза",
            "• новые входящие заявки",
            "• счета на оплату",
            "• CRSS оповещения",
          ].join("\n"),
          supabase,
        );
      } else if (text.startsWith("/id")) {
        const title = groupTitle || "(не определено)";
        await sendMessage(
          chatIdStr,
          [
            "🪪 Debug-информация",
            "",
            `group_id: ${chatIdStr}`,
            `chat_id: ${chatIdStr}`,
            `Название: ${title}`,
            `Тип чата: ${chatType}`,
          ].join("\n"),
          supabase,
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("max-webhook error:", e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
