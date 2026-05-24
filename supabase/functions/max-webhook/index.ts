// MAX Bot webhook — receives updates from botapi.max.ru
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://botapi.max.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function maxFetch(path: string, init?: RequestInit) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${MAX_API}${path}${sep}access_token=${token}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    console.error("MAX API error", res.status, text);
    throw new Error(`MAX API ${res.status}: ${text}`);
  }
  return data;
}

async function sendMessage(chatId: string | number, text: string) {
  return maxFetch(`/messages?chat_id=${chatId}`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

async function fetchChatTitle(chatId: string | number): Promise<string | null> {
  try {
    const data = await maxFetch(`/chats/${chatId}`);
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

  try {
    const update = await req.json();
    console.log("MAX update:", JSON.stringify(update));

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
      if (chatIdStr) groupTitle = await fetchChatTitle(chatIdStr);

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
          );
        }
        continue;
      }

      // Message handling
      const text: string = (msgPre?.body?.text || msgPre?.text || "").trim();
      if (!chatIdStr || !text) continue;

      if (text.startsWith("/start")) {
        await sendMessage(chatIdStr, "Бот снабжения активирован ✅");
        const title = groupTitle || `Чат ${chatIdStr}`;
        await sendMessage(chatIdStr, `ID этой группы: ${chatIdStr}\nНазвание: ${title}\nДобавьте её в настройках CRM CRSS.`);
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
