import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  console.log("=== HANDLING CALLBACK QUERY ===");
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  const chatId = callbackQuery.message.chat.id;
  const username = callbackQuery.from.username || "";
  const fullName = `${callbackQuery.from.first_name || ""} ${callbackQuery.from.last_name || ""}`.trim();

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
    newText += `\n\n📌 ТМЦ получено — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "Отмечено как получено 📦";
    console.log("Processing 'received' action:", { requestId: requests.id, newStatus, username });
  } else if (data === "approve") {
    // В РАБОТУ
    newStatus = "В РАБОТУ: СОГЛАСОВАНО";
    newText += `\n\n📌 В РАБОТУ — подтвердил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "Отмечено: В РАБОТУ ✅";
  } else if (data === "reject") {
    // ОТКЛОНЕНО
    newStatus = "ОТКЛОНЕНО";
    newText += `\n\n📌 ОТКЛОНЕНО — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "Отмечено: ОТКЛОНЕНО";
  } else if (data === "rework") {
    // НА ДОРАБОТКУ
    newText += `\n\n📌 НА ДОРАБОТКУ — ждём комментарий от: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "Пришлите одним сообщением комментарий 🔧";

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
  }

  // Update status in database (except for rework, which happens after comment)
  if (data !== "rework") {
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
  const chatId = message.chat.id;
  const text = message.text;
  const username = message.from.username || "";
  const fullName = `${message.from.first_name || ""} ${message.from.last_name || ""}`.trim();

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