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
      const type = u?.update_type || u?.type;

      // Deduplication
      const { data: existing } = await supabase
        .from("max_updates")
        .select("update_id")
        .eq("update_id", updateId)
        .maybeSingle();
      if (existing) continue;

      await supabase.from("max_updates").insert({
        update_id: updateId,
        chat_id: String(u?.chat_id ?? u?.message?.recipient?.chat_id ?? ""),
        payload: u,
      });

      // Bot added to chat -> save group automatically
      if (type === "bot_added" || type === "chat_title_changed") {
        const chatId = String(u?.chat_id ?? "");
        if (chatId) {
          const title = (await fetchChatTitle(chatId)) || `Чат ${chatId}`;
          // Save only if there is at least one organization linked manually.
          // Since we don't know which org a group belongs to, save with NULL org placeholder won't work due to FK.
          // Instead: log and let admin claim from UI. Also try linking to ALL orgs that have no group yet.
          // Simpler: send a confirmation message with chat_id so admin can register it.
          await sendMessage(
            chatId,
            `Бот снабжения CRSS подключён к группе «${title}». ID группы: ${chatId}\nДобавьте эту группу в настройках CRM, чтобы получать уведомления.`,
          );
        }
        continue;
      }

      // Message handling
      const msg = u?.message || u;
      const text: string = (msg?.body?.text || msg?.text || "").trim();
      const chatId = String(
        msg?.recipient?.chat_id ?? u?.chat_id ?? msg?.chat?.id ?? "",
      );
      if (!chatId || !text) continue;

      if (text.startsWith("/start")) {
        await sendMessage(chatId, "Бот снабжения активирован ✅");
        // Try to remember the group automatically
        const title = (await fetchChatTitle(chatId)) || `Чат ${chatId}`;
        await sendMessage(chatId, `ID этой группы: ${chatId}\nНазвание: ${title}\nДобавьте её в настройках CRM CRSS.`);
      } else if (text.startsWith("/help")) {
        await sendMessage(
          chatId,
          [
            "Команды бота снабжения CRSS:",
            "",
            "/start — активация бота",
            "/help — список команд",
            "/id — показать ID текущей группы",
            "",
            "Бот отправляет уведомления:",
            "• приход и перемещение груза",
            "• новые входящие заявки",
            "• счета на оплату",
            "• CRSS оповещения",
          ].join("\n"),
        );
      } else if (text.startsWith("/id")) {
        await sendMessage(chatId, `ID этой группы: ${chatId}`);
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
