// invoice-route: handles 2-stage inline button workflow for invoices in
// the accounting chat. Callbacks:
//   invroute:{request_id}:pay|to       → first click; show confirm/cancel
//   invconfirm:{request_id}:pay|to     → confirm routing; finalize message
//   invcancel:{request_id}              → back to initial buttons
// On confirm "pay" → enqueue invoice.pay_now event ("💰 ОПЛАТИТЬ СЧЁТ" + PDF).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_API = "https://platform-api.max.ru";
const TG_API = "https://api.telegram.org";

type Source = "telegram" | "max";
type Action = "select" | "confirm" | "cancel";
type Choice = "pay" | "to";

interface Body {
  request_id: string;
  action: Action;
  choice?: Choice;
  source: Source;
  chat_id: string | number;
  message_id: string | number;
  callback_id?: string;
  user?: { id?: any; name?: string | null; username?: string | null };
}

function tgKb(rows: Array<Array<{ text: string; callback_data: string }>>) {
  return { inline_keyboard: rows };
}
function maxKb(rows: Array<Array<{ type: "callback"; text: string; payload: string }>>) {
  return [{ type: "inline_keyboard", payload: { buttons: rows } }];
}

function initialKb(requestId: string) {
  return {
    tg: tgKb([[
      { text: "💰 Отписать в оплату", callback_data: `invroute:${requestId}:pay` },
      { text: "🔧 Отписать в ТО", callback_data: `invroute:${requestId}:to` },
    ]]),
    max: maxKb([[
      { type: "callback", text: "💰 Отписать в оплату", payload: `invroute:${requestId}:pay` },
      { type: "callback", text: "🔧 Отписать в ТО", payload: `invroute:${requestId}:to` },
    ]]),
  };
}
function confirmKb(requestId: string, choice: Choice) {
  const okText = choice === "pay" ? "✅ Подтвердить: в оплату" : "✅ Подтвердить: в ТО";
  return {
    tg: tgKb([[
      { text: okText, callback_data: `invconfirm:${requestId}:${choice}` },
      { text: "↩ Отмена", callback_data: `invcancel:${requestId}` },
    ]]),
    max: maxKb([[
      { type: "callback", text: okText, payload: `invconfirm:${requestId}:${choice}` },
      { type: "callback", text: "↩ Отмена", payload: `invcancel:${requestId}` },
    ]]),
  };
}

async function tgEdit(chatId: any, messageId: any, text: string, replyMarkup: any) {
  const tok = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${TG_API}/bot${tok}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup }),
  }).catch((e) => console.error("tgEdit failed", e));
}
async function tgAnswer(cbId: string | undefined, text: string, alert = false) {
  if (!cbId) return;
  const tok = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${TG_API}/bot${tok}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId, text, show_alert: alert }),
  }).catch(() => {});
}
async function maxEdit(messageId: any, text: string, attachments: any) {
  const tok = Deno.env.get("MAX_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${MAX_API}/messages?message_id=${encodeURIComponent(String(messageId))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: tok },
    body: JSON.stringify({ text, attachments }),
  }).catch((e) => console.error("maxEdit failed", e));
}
async function maxAnswer(cbId: string | undefined, text: string) {
  if (!cbId) return;
  const tok = Deno.env.get("MAX_BOT_TOKEN");
  if (!tok) return;
  await fetch(`${MAX_API}/answers/${encodeURIComponent(cbId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: tok },
    body: JSON.stringify({ notification: text }),
  }).catch(() => {});
}

function userLabel(u?: Body["user"]) {
  if (!u) return "пользователь";
  if (u.username) return "@" + u.username;
  if (u.name) return u.name;
  return "пользователь";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders });
  }
  const { request_id, action, choice, source, chat_id, message_id, callback_id, user } = body;
  if (!request_id || !action || !source) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
  }

  // Build the base invoice text via DB helper
  let baseText = "";
  try {
    const { data } = await supabase.rpc("build_request_message_by_id", { _request_id: request_id });
    if (typeof data === "string") baseText = data;
  } catch (e) { console.warn("build_request_message_by_id failed", e); }

  const who = userLabel(user);

  if (action === "select") {
    if (!choice) {
      return new Response(JSON.stringify({ error: "missing choice" }), { status: 400, headers: corsHeaders });
    }
    const choiceLabel = choice === "pay" ? "Отписать в оплату" : "Отписать в ТО";
    const text = `${baseText}\n\n⏳ Выбрано: ${choiceLabel} — ${who}\nПодтвердите действие.`;
    const kb = confirmKb(request_id, choice);
    if (source === "telegram") {
      await tgEdit(chat_id, message_id, text, kb.tg);
      await tgAnswer(callback_id, "Подтвердите выбор");
    } else {
      await maxEdit(message_id, text, kb.max);
      await maxAnswer(callback_id, "Подтвердите выбор");
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "cancel") {
    const kb = initialKb(request_id);
    if (source === "telegram") {
      await tgEdit(chat_id, message_id, baseText, kb.tg);
      await tgAnswer(callback_id, "Отменено");
    } else {
      await maxEdit(message_id, baseText, kb.max);
      await maxAnswer(callback_id, "Отменено");
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "confirm") {
    if (!choice) {
      return new Response(JSON.stringify({ error: "missing choice" }), { status: 400, headers: corsHeaders });
    }

    // Load current request
    const { data: r, error: rErr } = await supabase
      .from("requests")
      .select("id, organization_id, invoice_routing, invoice_number, description")
      .eq("id", request_id)
      .maybeSingle();
    if (rErr || !r) {
      if (source === "telegram") await tgAnswer(callback_id, "Заявка не найдена", true);
      else await maxAnswer(callback_id, "Заявка не найдена");
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: corsHeaders });
    }

    if ((r as any).invoice_routing) {
      const already = (r as any).invoice_routing === "payment" ? "Уже отписан в оплату" : "Уже отписан в ТО";
      const finalText = `${baseText}\n\n✅ ${already}`;
      if (source === "telegram") {
        await tgAnswer(callback_id, already, true);
        await tgEdit(chat_id, message_id, finalText, { inline_keyboard: [] });
      } else {
        await maxAnswer(callback_id, already);
        await maxEdit(message_id, finalText, []);
      }
      return new Response(JSON.stringify({ ok: false, error: "already_routed" }), { status: 409, headers: corsHeaders });
    }

    const routing = choice === "pay" ? "payment" : "to";
    const { error: updErr } = await supabase
      .from("requests")
      .update({ invoice_routing: routing, invoice_routed_at: new Date().toISOString() })
      .eq("id", request_id)
      .is("invoice_routing", null);
    if (updErr) {
      console.error("invoice_routing update failed", updErr);
    }

    // Audit log
    await supabase.from("request_activities").insert({
      request_id,
      organization_id: (r as any).organization_id,
      user_id: null,
      action: "invoice_routed",
      field_name: "invoice_routing",
      new_value: routing,
      description: `Счёт отписан ${routing === "payment" ? "в оплату" : "в ТО"} через ${source === "telegram" ? "Telegram" : "MAX"}`,
      snapshot: { source: `chat_button_${source}`, chat_user: user || null, choice, routing },
    });

    const finalLabel = routing === "payment"
      ? `✅ Отписан в оплату — ${who}`
      : `✅ Отписан в ТО — ${who}`;
    const finalText = `${baseText}\n\n${finalLabel}`;

    if (source === "telegram") {
      await tgEdit(chat_id, message_id, finalText, { inline_keyboard: [] });
      await tgAnswer(callback_id, finalLabel);
    } else {
      await maxEdit(message_id, finalText, []);
      await maxAnswer(callback_id, finalLabel);
    }

    if (routing === "payment") {
      const payText = `💰 ОПЛАТИТЬ СЧЁТ\n\n${baseText}`;
      try {
        await supabase.rpc("enqueue_notification", {
          _org_id: (r as any).organization_id,
          _event_type: "invoice.pay_now",
          _entity_type: "request",
          _entity_id: String(request_id),
          _text: payText,
          _payload: { request_id, kind: "pay_now", source_trigger: "invoice-route:confirm_pay" },
          _dedup_suffix: "pay_now",
        });
      } catch (e) {
        console.error("enqueue pay_now failed", e);
      }
      // Kick the worker so the message + PDF go out immediately
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notification-worker`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      }).catch((e) => console.warn("worker kick failed", e));
    }

    return new Response(JSON.stringify({ ok: true, routing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: corsHeaders });
});
