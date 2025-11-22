import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_WEBHOOK_SECRET_TOKEN = Deno.env.get("TELEGRAM_WEBHOOK_SECRET_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required environment variables");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Input validation schemas
const telegramUserSchema = z.object({
  username: z.string().max(100).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
});

const callbackQuerySchema = z.object({
  data: z.string().max(100),
  from: telegramUserSchema,
  message: z.object({
    message_id: z.number(),
    chat: z.object({ id: z.number() }),
  }),
});

const messageSchema = z.object({
  text: z.string().max(1000),
  from: telegramUserSchema,
  chat: z.object({ id: z.number() }),
  reply_to_message: z.object({
    message_id: z.number(),
  }).optional(),
});

async function sendTelegramRequest(method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await response.json();
}

async function updateRequestStatus(requestId: string, status: string, username: string, fullName: string) {
  console.log("Updating request status:", { requestId, status, username, fullName });
  
  const { data, error } = await supabase
    .from("requests")
    .update({ status, awaiting_comment_from: null })
    .eq("id", requestId)
    .select();

  if (error) {
    console.error("Error updating request:", error);
    throw error;
  }

  console.log("Request updated successfully:", data);
  return { username, fullName };
}

async function notifyAdmins(request: any, status: string, username: string, fullName: string) {
  console.log("Notifying admins about status change:", { requestId: request.id, status });
  
  // Get organization admins with telegram_user_id
  const { data: admins, error: adminsError } = await supabase
    .from("user_organizations")
    .select(`
      user_id,
      profiles!inner (
        telegram_user_id,
        full_name
      )
    `)
    .eq("organization_id", request.organization_id)
    .in("role", ["owner", "admin"])
    .not("profiles.telegram_user_id", "is", null);

  if (adminsError) {
    console.error("Error fetching admins:", adminsError);
    return;
  }

  if (!admins || admins.length === 0) {
    console.log("No admins with telegram_user_id found");
    return;
  }

  console.log(`Found ${admins.length} admins to notify`);

  // Send notification to each admin
  for (const admin of admins) {
    const profile = Array.isArray(admin.profiles) ? admin.profiles[0] : admin.profiles;
    const telegramUserId = profile?.telegram_user_id;
    if (!telegramUserId) continue;

    const message = `🔔 Изменен статус заявки\n\n` +
      `🧾 Заявка: ${request.description}\n` +
      `📋 Номер: ${request.request_number}\n` +
      `✅ Новый статус: ${status}\n` +
      `👤 Изменил: @${username || fullName}\n` +
      `📅 ${new Date().toLocaleString("ru-RU")}`;

    try {
      await sendTelegramRequest("sendMessage", {
        chat_id: telegramUserId,
        text: message,
        parse_mode: "HTML",
      });
      console.log(`Notification sent to admin: ${profile?.full_name}`);
    } catch (error) {
      console.error(`Failed to notify admin ${profile?.full_name}:`, error);
    }
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  // Validate input
  const validated = callbackQuerySchema.parse(callbackQuery);
  
  const data = validated.data;
  const messageId = validated.message.message_id;
  const chatId = validated.message.chat.id;
  const username = validated.from.username || "";
  const fullName = `${validated.from.first_name || ""} ${validated.from.last_name || ""}`.trim();

  console.log("Callback data:", data);
  console.log("Message ID:", messageId);
  console.log("Chat ID:", chatId);
  console.log("User:", username || fullName);

  // Find request by telegram_message_id
  const { data: requests, error: findError } = await supabase
    .from("requests")
    .select("*")
    .eq("telegram_message_id", messageId)
    .single();

  console.log("Finding request by telegram_message_id:", messageId);
  
  if (findError || !requests) {
    console.error("Request not found:", findError);
    console.error("Search criteria: telegram_message_id =", messageId);
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Заявка не найдена",
      show_alert: true,
    });
    return;
  }

  console.log("Request found:", requests.id, "Current status:", requests.status);

  let newText = callbackQuery.message.text;
  let newStatus = requests.status;
  let removeKeyboard = false;
  let alertText = "Отмечено";

  if (data === "received") {
    // ТМЦ ПОЛУЧЕНО
    newStatus = "Доставлено";
    newText += `\n\n✅ ТМЦ получено — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "✅ Успешно отмечено как получено!";
    console.log("Processing 'received' action:", { requestId: requests.id, newStatus, username });
  } else if (data === "approve") {
    // В РАБОТУ
    newStatus = "В РАБОТУ: СОГЛАСОВАНО";
    newText += `\n\n✅ В РАБОТУ — подтвердил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "✅ Успешно взято в работу!";
  } else if (data === "reject") {
    // ОТКЛОНЕНО
    newStatus = "ОТКЛОНЕНО";
    newText += `\n\n❌ ОТКЛОНЕНО — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "❌ Заявка отклонена";
  } else if (data === "rework") {
    // НА ДОРАБОТКУ
    newText += `\n\n🔧 НА ДОРАБОТКУ — ждём комментарий от: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "📝 Пожалуйста, пришлите комментарий следующим сообщением";

    // Save who we're waiting comment from
    const { error: updateError } = await supabase
      .from("requests")
      .update({ 
        awaiting_comment_from: username || fullName,
      })
      .eq("id", requests.id);

    if (updateError) {
      console.error("Error updating awaiting_comment_from:", updateError);
    }
  } else if (data === "paid") {
    // ОТПИСАНО В ОПЛАТУ
    newStatus = "Оплачено";
    newText += `\n\n✅ Отписано в оплату — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "✅ Успешно отмечено как оплачено!";
    console.log("Processing 'paid' action:", { requestId: requests.id, newStatus, username });
  } else if (data === "exclude") {
    // Показываем подтверждение удаления
    await sendTelegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Да, исключить", callback_data: "confirm_exclude" }],
          [{ text: "↩️ Отмена", callback_data: "cancel_exclude" }]
        ]
      }
    });

    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Подтвердите исключение заявки",
    });
    return;
  } else if (data === "cancel_exclude") {
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Отменено",
    });
    return;
  } else if (data === "confirm_exclude") {
    // Удаляем заявку и обновляем сообщение
    try {
      // Аудит
      await supabase.from("audit_logs").insert({
        organization_id: requests.organization_id,
        user_id: callbackQuery.from.id?.toString?.() || "",
        action: "delete",
        entity_type: "request",
        entity_id: requests.id,
        old_values: {
          request_number: requests.request_number,
          description: requests.description,
          status: requests.status,
          deletion_reason: "Исключена по просьбе заявителя",
          deleted_by: username || fullName,
        }
      });

      const { error: delErr } = await supabase
        .from("requests")
        .delete()
        .eq("id", requests.id);

      if (delErr) throw delErr;

      newText += `\n\n🗑 Исключена по просьбе заявителя — исключил: @${username || fullName}`;
      removeKeyboard = true;
      alertText = "Заявка исключена";
    } catch (err) {
      console.error("Error deleting request:", err);
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Ошибка исключения",
        show_alert: true,
      });
      return;
    }
  }

  // Update status in database (except for rework, which happens after comment and exclude which deletes)
  if (data !== "rework" && data !== "confirm_exclude") {
    await updateRequestStatus(requests.id, newStatus, username, fullName);
    // Notify admins about status change
    await notifyAdmins(requests, newStatus, username, fullName);
  }

  // Update message
  await sendTelegramRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    reply_markup: removeKeyboard ? undefined : callbackQuery.message.reply_markup,
  });

  // Answer callback query
  await sendTelegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
    text: alertText,
  });
}

async function handleMessage(message: any) {
  // Validate input
  const validated = messageSchema.parse(message);

  const chatId = validated.chat.id;
  const text = validated.text;
  const username = validated.from.username || "";
  const fullName = `${validated.from.first_name || ""} ${validated.from.last_name || ""}`.trim();

  console.log("Message from:", username || fullName, "Text:", text);

  // Check if we're waiting for a comment from this user
  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("awaiting_comment_from", username || fullName)
    .not("awaiting_comment_from", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error finding request:", error);
    return;
  }

  if (requests && requests.length > 0) {
    const request = requests[0];
    
    // Update request with comment and status
    const { error: updateError } = await supabase
      .from("requests")
      .update({
        comments: text,
        status: "На доработку",
        awaiting_comment_from: null,
      })
      .eq("id", request.id);

    if (updateError) {
      console.error("Error updating request:", updateError);
    } else {
      console.log("Comment added to request:", request.id);
      // Notify admins about rework status
      await notifyAdmins(request, "На доработку", username, fullName);
    }
  }
}

serve(async (req) => {
  console.log("=== TELEGRAM WEBHOOK CALLED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request - returning CORS headers");
    return new Response(null, { headers: corsHeaders });
  }

  // Verify Telegram secret token (if configured)
  if (TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretToken !== TELEGRAM_WEBHOOK_SECRET_TOKEN) {
      console.error("Invalid secret token. Expected:", TELEGRAM_WEBHOOK_SECRET_TOKEN, "Received:", secretToken || "no token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: corsHeaders }
      );
    }
    console.log("Webhook request verified with secret token");
  } else {
    console.log("Webhook running without secret token verification (not recommended for production)");
  }

  console.log("Webhook request received from Telegram with valid secret token");

  // Only accept POST requests from Telegram
  if (req.method !== "POST") {
    console.log("Non-POST request - returning info message");
    return new Response(JSON.stringify({ status: "ok", message: "Telegram webhook is running" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const update = await req.json();
    console.log("=== Telegram update received ===");
    console.log("Full update:", JSON.stringify(update, null, 2));

    if (update.callback_query) {
      console.log("Processing callback_query");
      await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
      console.log("Processing message");
      await handleMessage(update.message);
    } else {
      console.log("Unknown update type:", Object.keys(update));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("=== ERROR IN WEBHOOK ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});