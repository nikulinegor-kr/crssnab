// MAX Bot webhook — receives updates from botapi.max.ru
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://botapi.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupaClient = ReturnType<typeof createClient>;
let LAST_AUTH_MODE: "bearer" | "query" = "bearer";

async function maxFetch(path: string, init?: RequestInit, supabase?: SupaClient) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");

  const tryRequest = async (mode: "bearer" | "query") => {
    let url = `${MAX_API}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (mode === "bearer") {
      headers["Authorization"] = `Bearer ${token}`;
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

  // Try last known good mode first, fall back to the other on auth failure
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
        group_id: null,
        chat_id: null,
        group_name: null,
        payload: { path, method: init?.method || "GET", status: r.res.status, response: r.data },
      });
    }

    if (r.res.ok) {
      LAST_AUTH_MODE = mode;
      return r.data;
    }
    // only retry the other mode on auth-related failure
    if (![401, 403, 404].includes(r.res.status)) break;
  }
  throw new Error(`MAX API ${last?.res.status}: ${last?.text}`);
}

async function sendMessage(chatId: string | number, text: string, supabase?: SupaClient) {
  return maxFetch(
    `/messages?chat_id=${chatId}`,
    { method: "POST", body: JSON.stringify({ text }) },
    supabase,
  );
}

async function fetchChatTitle(chatId: string | number, supabase?: SupaClient): Promise<string | null> {
  try {
    const data = await maxFetch(`/chats/${chatId}`, undefined, supabase);
    return data?.title ?? null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Test endpoint: GET /test-max?chat_id=...&text=...
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/test-max")) {
    const chatId = url.searchParams.get("chat_id") || url.searchParams.get("group_id");
    const text = url.searchParams.get("text") || "✅ Тестовое сообщение от CRSS CRM (MAX bot)";
    if (!chatId) {
      return new Response(JSON.stringify({ ok: false, error: "chat_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const result = await sendMessage(chatId, text, supabase);
      return new Response(JSON.stringify({ ok: true, auth_mode: LAST_AUTH_MODE, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, auth_mode: LAST_AUTH_MODE, error: e?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }



  try {
    const update = await req.json();
    console.log("MAX update (raw):", JSON.stringify(update));

    // Log the raw incoming payload immediately, before any per-update processing
    await supabase.from("max_webhook_logs").insert({
      event_type: "incoming_raw",
      group_id: null,
      chat_id: null,
      group_name: null,
      payload: update,
    });

    const updates = Array.isArray(update?.updates) ? update.updates : [update];

    for (const u of updates) {
      const updateId = u?.update_id ?? u?.timestamp ?? Date.now();
      const type = u?.update_type || u?.type || "unknown";
      const msgPre = u?.message || {};
      const chatIdRaw =
        u?.chat_id ??
        msgPre?.recipient?.chat_id ??
        msgPre?.chat?.id ??
        u?.chat?.id ??
        "";
      const chatIdStr = chatIdRaw ? String(chatIdRaw) : "";
      const chatType: string =
        msgPre?.recipient?.chat_type ?? u?.chat_type ?? u?.chat?.type ?? "unknown";

      // Try to resolve group title (best-effort, may fail for dialogs)
      let groupTitle: string | null = null;
      if (chatIdStr) groupTitle = await fetchChatTitle(chatIdStr, supabase);

      // Log every event
      await supabase.from("max_webhook_logs").insert({
        event_type: type,
        group_id: chatIdStr || null,
        chat_id: chatIdStr || null,
        group_name: groupTitle,
        payload: u,
      });

      // Deduplication
      const { data: existing } = await supabase
        .from("max_updates")
        .select("update_id")
        .eq("update_id", updateId)
        .maybeSingle();
      if (existing) continue;

      await supabase.from("max_updates").insert({
        update_id: updateId,
        chat_id: chatIdStr,
        payload: u,
      });

      // Bot added to chat -> auto-confirm
      if (type === "bot_added" || type === "chat_title_changed") {
        if (chatIdStr) {
          const title = groupTitle || `Чат ${chatIdStr}`;
          await sendMessage(
            chatIdStr,
            `Бот снабжения CRSS подключён к группе «${title}». ID группы: ${chatIdStr}\nДобавьте эту группу в настройках CRM, чтобы получать уведомления.`,
            supabase,
          );
        }
        continue;
      }

      // Message handling
      const text: string = (msgPre?.body?.text || msgPre?.text || "").trim();
      if (!chatIdStr || !text) continue;

      if (text.startsWith("/start")) {
        await sendMessage(chatIdStr, "Бот снабжения активирован ✅", supabase);
        const title = groupTitle || `Чат ${chatIdStr}`;
        await sendMessage(chatIdStr, `ID этой группы: ${chatIdStr}\nНазвание: ${title}\nДобавьте её в настройках CRM CRSS.`, supabase);
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
      status: 200, // always 200 so MAX не ретраит вечно
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
