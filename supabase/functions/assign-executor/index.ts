// assign-executor: invoked by telegram-webhook & max-webhook when a user taps an
// inline button "assign:{request_id}:{executor_id}". Atomically assigns the executor,
// flips status to "Новая заявка", logs the audit event, and edits the original
// incoming-group message to "✅ Исполнитель назначен: {name}".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_API = "https://platform-api.max.ru";
const TG_API = "https://api.telegram.org";

type Source = "telegram" | "max";

interface Body {
  request_id: string;
  executor_id: string;
  source: Source;
  chat_id: string | number;
  message_id: string | number;
  callback_id?: string;
  user?: { id?: string | number | null; name?: string | null; username?: string | null };
}

async function tgAnswer(callbackId: string | undefined, text: string, alert = false) {
  if (!callbackId) return;
  const tok = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${TG_API}/bot${tok}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: alert }),
  }).catch(() => {});
}

async function tgEditMessage(chatId: string | number, messageId: string | number, text: string) {
  const tok = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!tok) return;
  // Send empty inline_keyboard to remove the executor buttons in-place.
  await fetch(`${TG_API}/bot${tok}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: { inline_keyboard: [] },
    }),
  }).catch(() => {});
}

async function maxAnswer(callbackId: string | undefined, text: string) {
  if (!callbackId) return;
  const tok = Deno.env.get("MAX_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${MAX_API}/answers/${encodeURIComponent(callbackId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: tok },
    body: JSON.stringify({ notification: text }),
  }).catch(() => {});
}

async function maxEditMessage(messageId: string | number, text: string) {
  const tok = Deno.env.get("MAX_BOT_TOKEN");
  if (!tok) return;
  // attachments: [] removes the inline button keyboard from the original message.
  await fetch(`${MAX_API}/messages?message_id=${encodeURIComponent(String(messageId))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: tok },
    body: JSON.stringify({ text, attachments: [] }),
  }).catch(() => {});
}

async function buildAssignedText(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  fallbackExecutorName: string,
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("build_assigned_message_by_id", {
      _request_id: requestId,
    });
    if (!error && typeof data === "string" && data.length > 0) return data;
  } catch (e) {
    console.warn("build_assigned_message_by_id failed:", e);
  }
  return `✅ Исполнитель назначен: ${fallbackExecutorName}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders });
  }

  const { request_id, executor_id, source, chat_id, message_id, callback_id, user } = body;
  if (!request_id || !executor_id || !source) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
  }

  // Load executor
  const { data: executor, error: execErr } = await supabase
    .from("request_participants")
    .select("id, name, organization_id")
    .eq("id", executor_id)
    .maybeSingle();

  if (execErr || !executor) {
    if (source === "telegram") await tgAnswer(callback_id, "Исполнитель не найден", true);
    else await maxAnswer(callback_id, "Исполнитель не найден");
    return new Response(JSON.stringify({ ok: false, error: "executor not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load current request for audit & guard
  const { data: current, error: curErr } = await supabase
    .from("requests")
    .select("id, status, executor, organization_id, request_number, description, applicant, contractor")
    .eq("id", request_id)
    .maybeSingle();

  if (curErr || !current) {
    if (source === "telegram") await tgAnswer(callback_id, "Заявка не найдена", true);
    else await maxAnswer(callback_id, "Заявка не найдена");
    return new Response(JSON.stringify({ ok: false, error: "request not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (current.executor && current.executor.trim() !== "") {
    const msg = `Исполнитель уже выбран: ${current.executor}`;
    if (source === "telegram") {
      await tgAnswer(callback_id, msg, true);
      await tgEditMessage(chat_id, message_id, `✅ Исполнитель назначен: ${current.executor}`);
    } else {
      await maxAnswer(callback_id, msg);
      await maxEditMessage(message_id, `✅ Исполнитель назначен: ${current.executor}`);
    }
    return new Response(JSON.stringify({ ok: false, error: "already_assigned", executor: current.executor }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Atomic claim: update only when executor is still empty
  const { data: updated, error: updErr } = await supabase
    .from("requests")
    .update({ executor: executor.name, status: "Новая заявка" })
    .eq("id", request_id)
    .or("executor.is.null,executor.eq.")
    .select("id, executor, status")
    .maybeSingle();

  if (updErr || !updated) {
    // Another concurrent assignment won the race
    const { data: again } = await supabase
      .from("requests")
      .select("executor")
      .eq("id", request_id)
      .maybeSingle();
    const who = again?.executor || "—";
    const msg = `Исполнитель уже выбран: ${who}`;
    if (source === "telegram") {
      await tgAnswer(callback_id, msg, true);
      await tgEditMessage(chat_id, message_id, `✅ Исполнитель назначен: ${who}`);
    } else {
      await maxAnswer(callback_id, msg);
      await maxEditMessage(message_id, `✅ Исполнитель назначен: ${who}`);
    }
    return new Response(JSON.stringify({ ok: false, error: "race_lost", executor: who }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Audit log
  await supabase.from("request_activities").insert({
    request_id,
    organization_id: current.organization_id,
    user_id: null,
    action: "executor_assigned",
    field_name: "executor",
    old_value: current.executor,
    new_value: executor.name,
    description: `Исполнитель назначен через ${source === "telegram" ? "Telegram" : "MAX"}: ${executor.name}`,
    snapshot: {
      source: `chat_button_${source}`,
      chat_user: user || null,
      old_status: current.status,
      new_status: "Новая заявка",
    },
  });

  // Edit the original incoming-group message (remove buttons, replace text)
  const replacement = `✅ Исполнитель назначен: ${executor.name}`;
  try {
    if (source === "telegram") {
      await tgEditMessage(chat_id, message_id, replacement);
      await tgAnswer(callback_id, `Назначено: ${executor.name}`);
    } else {
      await maxEditMessage(message_id, replacement);
      await maxAnswer(callback_id, `Назначено: ${executor.name}`);
    }
  } catch (e) {
    console.warn("edit original message failed:", e);
  }

  return new Response(JSON.stringify({ ok: true, executor: executor.name }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
