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
    text: z.string().optional(),
  }),
});

const messageSchema = z.object({
  text: z.string().max(4000).optional(),
  caption: z.string().max(4000).optional(),
  from: telegramUserSchema,
  chat: z.object({ id: z.number() }),
  reply_to_message: z.object({
    message_id: z.number(),
  }).optional(),
  photo: z.array(z.object({
    file_id: z.string(),
    file_unique_id: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
    file_size: z.number().optional(),
  })).optional(),
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

// Get available statuses for inline keyboard
async function getOrganizationStatuses(orgId: string) {
  const { data, error } = await supabase
    .from("request_statuses")
    .select("name, color")
    .eq("organization_id", orgId)
    .order("order", { ascending: true });
  
  if (error) {
    console.error("Error fetching statuses:", error);
    return [];
  }
  return data || [];
}

async function notifyGroupAboutStatusChange(request: any, status: string, username: string, fullName: string) {
  console.log("Notifying group about status change:", { requestId: request.id, status });
  
  // Get organization telegram settings
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("telegram_chat_id, telegram_bot_token")
    .eq("id", request.organization_id)
    .single();

  if (orgError || !org) {
    console.error("Error fetching organization:", orgError);
    return;
  }

  if (!org.telegram_chat_id || !org.telegram_bot_token) {
    console.log("Telegram not configured for organization");
    return;
  }

  const message = `🔔 Изменен статус заявки\n\n` +
    `🧾 Заявка: ${request.description}\n` +
    `📋 Номер: ${request.request_number}\n` +
    `✅ Новый статус: ${status}\n` +
    `👤 Изменил: @${username || fullName}\n` +
    `📅 ${new Date().toLocaleString("ru-RU")}`;

  try {
    await sendTelegramRequest("sendMessage", {
      chat_id: org.telegram_chat_id,
      text: message,
      parse_mode: "HTML",
    });
    console.log("Status change notification sent to group");
  } catch (error) {
    console.error("Failed to send status change notification to group:", error);
  }
}

// Get status emoji helper
function getStatusEmoji(status: string): string {
  const s = status?.toLowerCase() || "";
  if (s.includes("доставлено")) return "✅";
  if (s.includes("оплачено")) return "💰";
  if (s.includes("отклонено")) return "❌";
  if (s.includes("закрыто") || s.includes("выполнено")) return "🏁";
  return "📋";
}

// Find organization by chat_id
async function findOrganizationByChatId(chatId: number) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("telegram_chat_id", chatId.toString())
    .single();
  
  if (error) {
    console.error("Error finding organization by chat_id:", error);
    return null;
  }
  return data;
}

// Build original keyboard for a request (same logic as notify-telegram)
async function buildOriginalKeyboard(request: any, supabaseClient: any) {
  const status = request.status?.toLowerCase() || "";
  const comments = request.comments?.toLowerCase() || "";
  const documentUrl = request.document_url || "";
  
  const keyboard: any[][] = [];

  // Кнопка Получение подтверждено / Приёмка - показываем только если статус "Доставлено в ТК"
  if (status.includes("доставлено в тк")) {
    // Check if already received confirmed
    const { data: receivedActivity } = await supabaseClient
      .from("request_activities")
      .select("id")
      .eq("request_id", request.id)
      .eq("action", "received_confirmed")
      .limit(1);
    
    if (receivedActivity && receivedActivity.length > 0) {
      // Already received - show acceptance buttons
      keyboard.push([{ text: "🟢 Принято без замечаний", callback_data: "accepted_ok" }]);
      keyboard.push([{ text: "🔴 Обнаружено несоответствие", callback_data: "discrepancy" }]);
    } else {
      keyboard.push([{ text: "📦 Получение подтверждено", callback_data: "received" }]);
    }
  }

  // Кнопки согласования
  if (comments.includes("требуется согласование")) {
    keyboard.push([{ text: "✅ В РАБОТУ", callback_data: "approve" }]);
    keyboard.push([{ text: "🔧 НА ДОРАБОТКУ", callback_data: "rework" }]);
    keyboard.push([{ text: "❌ ОТКЛОНЕНО", callback_data: "reject" }]);
  }

  // Кнопка "Отписано в оплату" для статуса "Счёт в Бухгалтерии"
  if (status.includes("счёт в бухгалтерии")) {
    keyboard.push([{ text: "✅ Отписано в оплату", callback_data: "paid" }]);
  }

  // Кнопка открыть счёт
  if (status.includes("счёт в бухгалтерии") && documentUrl && (documentUrl.startsWith("http://") || documentUrl.startsWith("https://"))) {
    try {
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
      if (bucketIndex !== -1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        const { data, error } = await supabaseClient.storage
          .from('request-documents')
          .createSignedUrl(filePath, 86400);
        
        if (!error && data?.signedUrl) {
          keyboard.push([{ text: "📄 Открыть счёт", url: data.signedUrl }]);
        } else {
          keyboard.push([{ text: "📄 Открыть счёт", url: documentUrl }]);
        }
      } else {
        keyboard.push([{ text: "📄 Открыть счёт", url: documentUrl }]);
      }
    } catch (error) {
      console.error('Error processing document URL:', error);
      keyboard.push([{ text: "📄 Открыть счёт", url: documentUrl }]);
    }
  }

  // Универсальная кнопка "Изменить статус"
  if (request.id) {
    keyboard.push([{ 
      text: "🔄 Изменить статус", 
      callback_data: "change_status" 
    }]);
  }

  return keyboard;
}

// Handle /archive command
async function handleArchiveCommand(chatId: number, page: number = 0) {
  const org = await findOrganizationByChatId(chatId);
  if (!org) {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "❌ Организация не найдена для этого чата",
    });
    return;
  }

  const pageSize = 10;
  const offset = page * pageSize;

  // Get archived/completed requests
  const { data: requests, error, count } = await supabase
    .from("requests")
    .select("id, request_number, description, status, updated_at", { count: "exact" })
    .eq("organization_id", org.id)
    .or("archived.eq.true,status.in.(Доставлено,Отклонено,Оплачено,Выполнено,Закрыто)")
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Error fetching archive:", error);
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "❌ Ошибка загрузки архива",
    });
    return;
  }

  if (!requests || requests.length === 0) {
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: "📦 Архив пуст\n\nЗавершённые заявки появятся здесь после получения статусов: Доставлено, Оплачено, Отклонено и т.д.",
    });
    return;
  }

  const totalPages = Math.ceil((count || 0) / pageSize);
  
  let messageText = `📦 *Архив заявок* (стр. ${page + 1}/${totalPages})\n\n`;
  
  requests.forEach((req: any, index: number) => {
    const statusEmoji = getStatusEmoji(req.status);
    const date = new Date(req.updated_at).toLocaleDateString("ru-RU");
    const shortDesc = req.description.length > 30 
      ? req.description.substring(0, 30) + "..." 
      : req.description;
    messageText += `${offset + index + 1}. ${statusEmoji} *${req.request_number}*\n`;
    messageText += `   ${shortDesc}\n`;
    messageText += `   📅 ${date} | ${req.status}\n\n`;
  });

  // Build pagination keyboard
  const keyboard: any[][] = [];
  
  // Detail buttons for each request (2 per row)
  for (let i = 0; i < requests.length; i += 2) {
    const row = [];
    row.push({
      text: `📋 ${requests[i].request_number}`,
      callback_data: `archive_detail_${requests[i].id.substring(0, 20)}`
    });
    if (requests[i + 1]) {
      row.push({
        text: `📋 ${requests[i + 1].request_number}`,
        callback_data: `archive_detail_${requests[i + 1].id.substring(0, 20)}`
      });
    }
    keyboard.push(row);
  }

  // Pagination buttons
  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: "⬅️ Назад", callback_data: `archive_page_${page - 1}` });
  }
  if (page < totalPages - 1) {
    navRow.push({ text: "Вперёд ➡️", callback_data: `archive_page_${page + 1}` });
  }
  if (navRow.length > 0) {
    keyboard.push(navRow);
  }

  await sendTelegramRequest("sendMessage", {
    chat_id: chatId,
    text: messageText,
    parse_mode: "Markdown",
    reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
  });
}

// Handle /help command
async function handleHelpCommand(chatId: number) {
  const helpText = `🤖 *Команды бота*\n\n` +
    `/archive — 📦 Архив завершённых заявок\n` +
    `/help — ❓ Справка по командам\n\n` +
    `*Кнопки в сообщениях:*\n` +
    `• ✅ Получение подтверждено — отметить доставку\n` +
    `• ✅ В РАБОТУ — согласовать заявку\n` +
    `• 🔧 НА ДОРАБОТКУ — запросить правки\n` +
    `• ❌ ОТКЛОНЕНО — отклонить заявку\n` +
    `• 🔄 Изменить статус — выбрать другой статус\n\n` +
    `💡 При финальном статусе все предыдущие сообщения по заявке удаляются автоматически.`;

  await sendTelegramRequest("sendMessage", {
    chat_id: chatId,
    text: helpText,
    parse_mode: "Markdown",
  });
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

  // Handle archive pagination
  if (data.startsWith("archive_page_")) {
    const page = parseInt(data.replace("archive_page_", ""));
    
    // Delete current message and send new one with updated page
    await sendTelegramRequest("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
    
    await handleArchiveCommand(chatId, page);
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
    });
    return;
  }

  // Handle archive detail view
  if (data.startsWith("archive_detail_")) {
    const requestIdPart = data.replace("archive_detail_", "");
    
    const { data: request, error } = await supabase
      .from("requests")
      .select("*")
      .like("id", `${requestIdPart}%`)
      .single();
    
    if (error || !request) {
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }

    // Build detailed message
    let detailText = `📋 *Заявка ${request.request_number}*\n\n`;
    detailText += `📝 ${request.description}\n`;
    detailText += `📊 Статус: ${request.status}\n`;
    
    if (request.priority) detailText += `⭐ Приоритет: ${request.priority}\n`;
    if (request.applicant) detailText += `👤 Заявитель: ${request.applicant}\n`;
    if (request.executor) detailText += `🔧 Исполнитель: ${request.executor}\n`;
    if (request.contractor) detailText += `🏢 Контрагент: ${request.contractor}\n`;
    if (request.amount) detailText += `💰 Сумма: ${request.amount.toLocaleString("ru-RU")} ₽\n`;
    if (request.invoice_number) detailText += `💳 Счёт: ${request.invoice_number}\n`;
    if (request.transport_company) detailText += `🚛 ТК: ${request.transport_company}\n`;
    if (request.delivery_date) {
      detailText += `📅 Дата доставки: ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}\n`;
    }
    if (request.comments) detailText += `\n💬 Комментарий: ${request.comments}\n`;
    
    detailText += `\n📅 Создано: ${new Date(request.created_at).toLocaleDateString("ru-RU")}`;
    detailText += `\n📅 Обновлено: ${new Date(request.updated_at).toLocaleDateString("ru-RU")}`;

    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: detailText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "↩️ Назад к архиву", callback_data: "archive_back" }
        ]]
      }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
    });
    return;
  }

  // Handle back to archive
  if (data === "archive_back") {
    await handleArchiveCommand(chatId, 0);
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
    });
    return;
  }

  // Handle summary callbacks (from daily summary)
  if (data.startsWith("summary_received_")) {
    const requestId = data.replace("summary_received_", "");
    console.log("Processing summary received for request:", requestId);
    
    // Find request by partial ID
    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .like("id", `${requestId}%`)
      .single();
    
    if (error || !requests) {
      console.error("Request not found:", error);
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }
    
    await updateRequestStatus(requests.id, "Доставлено", username, fullName);
    await notifyGroupAboutStatusChange(requests, "Доставлено", username, fullName);
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "✅ Отмечено как полученное!",
    });
    return;
  }

  // Handle status change from inline keyboard
  if (data.startsWith("status_")) {
    const parts = data.split("_");
    const statusIndex = parseInt(parts[1]);
    
    console.log("Processing status change:", { statusIndex, messageId });
    
    // Find request by telegram_message_id (reliable method)
    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .eq("telegram_message_id", messageId)
      .maybeSingle();
    
    if (error || !requests) {
      console.error("Request not found by message_id:", messageId, error);
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }
    
    // Get statuses
    const statuses = await getOrganizationStatuses(requests.organization_id);
    const newStatus = statuses[statusIndex]?.name;
    
    if (!newStatus) {
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Статус не найден",
        show_alert: true,
      });
      return;
    }
    
    await updateRequestStatus(requests.id, newStatus, username, fullName);
    await notifyGroupAboutStatusChange(requests, newStatus, username, fullName);
    
    // Update the message to show new status
    const originalText = validated.message.text || "";
    const newText = originalText + `\n\n✅ Статус изменён на "${newStatus}" — @${username || fullName}`;
    await sendTelegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: `✅ Статус изменён на "${newStatus}"`,
    });
    return;
  }

  // Handle show_statuses callback
  if (data.startsWith("show_statuses_")) {
    // Find request by telegram_message_id (reliable method)
    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .eq("telegram_message_id", messageId)
      .maybeSingle();
    
    if (error || !requests) {
      console.error("Request not found by message_id:", messageId, error);
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }
    
    // Get statuses
    const statuses = await getOrganizationStatuses(requests.organization_id);
    
    // Build keyboard with all statuses (max 8 to fit telegram limits)
    const keyboard: any[][] = [];
    const displayStatuses = statuses.slice(0, 8);
    
    for (let i = 0; i < displayStatuses.length; i += 2) {
      const row = [];
      row.push({
        text: displayStatuses[i].name,
        callback_data: `status_${i}_${requests.id.substring(0, 20)}`
      });
      if (displayStatuses[i + 1]) {
        row.push({
          text: displayStatuses[i + 1].name,
          callback_data: `status_${i + 1}_${requests.id.substring(0, 20)}`
        });
      }
      keyboard.push(row);
    }
    
    keyboard.push([{ text: "↩️ Назад", callback_data: `back_${requests.id.substring(0, 25)}` }]);
    
    await sendTelegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Выберите новый статус",
    });
    return;
  }

  // Handle back callback - restore original keyboard
  if (data.startsWith("back_")) {
    // Find request by telegram_message_id (more reliable than partial UUID)
    const { data: request, error } = await supabase
      .from("requests")
      .select("*")
      .eq("telegram_message_id", messageId)
      .maybeSingle();
    
    if (error || !request) {
      console.error("Request not found for back by message_id:", messageId, error);
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }
    
    // Rebuild original keyboard based on request status
    const keyboard = await buildOriginalKeyboard(request, supabase);
    
    await sendTelegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
    });
    return;
  }

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

  const originalText = validated.message.text || "";
  let newText = originalText;
  let newStatus = requests.status;
  let removeKeyboard = false;
  let alertText = "Отмечено";
  let isFinalStatus = false;
  let shouldDeletePreviousMessage = false;

  if (data === "received") {
    // Step 1: Получение подтверждено — промежуточный шаг (НЕ финальный)
    const now = new Date().toLocaleString("ru-RU");
    console.log("Processing 'received' action (intermediate):", { requestId: requests.id, username });
    
    // Log activity
    await supabase.from("request_activities").insert({
      request_id: requests.id,
      organization_id: requests.organization_id,
      action: "received_confirmed",
      description: `✅ Получение подтверждено — отметил: @${username || fullName}, ${now}`,
    });
    
    newText += `\n\n✅ Получение подтверждено — отметил: @${username || fullName}, ${now}`;
    
    // Show Step 2 buttons: acceptance or discrepancy
    await sendTelegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Принято без замечаний", callback_data: "accepted_ok" }],
          [{ text: "🔴 Обнаружено несоответствие", callback_data: "discrepancy" }],
        ]
      }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "✅ Получение подтверждено",
    });
    return;
  } else if (data === "accepted_ok") {
    // Step 2a: Принято без замечаний — ФИНАЛЬНЫЙ СТАТУС
    const now = new Date().toLocaleString("ru-RU");
    console.log("Processing 'accepted_ok' action:", { requestId: requests.id, username });
    
    await supabase.from("request_activities").insert({
      request_id: requests.id,
      organization_id: requests.organization_id,
      action: "accepted_no_issues",
      description: `🟢 Принято без замечаний — отметил: @${username || fullName}, ${now}`,
    });
    
    newStatus = "Доставлено";
    newText += `\n\n🟢 Принято без замечаний — отметил: @${username || fullName}, ${now}`;
    removeKeyboard = true;
    alertText = "✅ Принято без замечаний!";
    isFinalStatus = true;
    shouldDeletePreviousMessage = true;
  } else if (data === "discrepancy") {
    // Step 2b: Обнаружено несоответствие — показать выбор типа
    const now = new Date().toLocaleString("ru-RU");
    console.log("Processing 'discrepancy' action:", { requestId: requests.id, username });
    
    await supabase.from("request_activities").insert({
      request_id: requests.id,
      organization_id: requests.organization_id,
      action: "discrepancy_found",
      description: `🔴 Обнаружено несоответствие — отметил: @${username || fullName}, ${now}`,
    });
    
    // Update status to Несоответствие
    await updateRequestStatus(requests.id, "Несоответствие", username, fullName);
    
    newText += `\n\n🔴 Обнаружено несоответствие — отметил: @${username || fullName}, ${now}`;
    newText += `\n\nВыберите тип несоответствия:`;
    
    await sendTelegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔢 Парт-номер", callback_data: "discrepancy_type_part" }],
          [{ text: "📦 Количество", callback_data: "discrepancy_type_qty" }],
          [{ text: "❌ Не та позиция", callback_data: "discrepancy_type_wrong" }],
          [{ text: "💥 Повреждение", callback_data: "discrepancy_type_damage" }],
        ]
      }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Выберите тип несоответствия",
    });
    return;
  } else if (data.startsWith("discrepancy_type_")) {
    // Step 3: Тип несоответствия выбран — запросить описание
    const typeMap: Record<string, string> = {
      "discrepancy_type_part": "Парт-номер",
      "discrepancy_type_qty": "Количество",
      "discrepancy_type_wrong": "Не та позиция",
      "discrepancy_type_damage": "Повреждение",
    };
    const discrepancyType = typeMap[data] || "Неизвестный тип";
    const now = new Date().toLocaleString("ru-RU");
    console.log("Processing discrepancy type:", { requestId: requests.id, type: discrepancyType, username });
    
    await supabase.from("request_activities").insert({
      request_id: requests.id,
      organization_id: requests.organization_id,
      action: "discrepancy_type_selected",
      field_name: "discrepancy_type",
      new_value: discrepancyType,
      description: `📋 Тип несоответствия: ${discrepancyType} — @${username || fullName}, ${now}`,
    });
    
    // Save awaiting state with discrepancy context
    await supabase
      .from("requests")
      .update({ 
        awaiting_comment_from: `discrepancy:${username || fullName}:${discrepancyType}`,
      })
      .eq("id", requests.id);
    
    newText += `\n📋 Тип: ${discrepancyType}`;
    newText += `\n\n📝 Опишите проблему и приложите фото следующим сообщением.`;
    
    await sendTelegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Отправьте описание проблемы",
    });
    return;
  } else if (data === "approve") {
    // В РАБОТУ
    newStatus = "В РАБОТУ: СОГЛАСОВАНО";
    newText += `\n\n✅ В РАБОТУ — подтвердил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "✅ Успешно взято в работу!";
  } else if (data === "reject") {
    // ОТКЛОНЕНО - ФИНАЛЬНЫЙ СТАТУС
    newStatus = "ОТКЛОНЕНО";
    newText += `\n\n❌ ОТКЛОНЕНО — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "❌ Заявка отклонена";
    isFinalStatus = true;
    shouldDeletePreviousMessage = true;
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
    // ОТПИСАНО В ОПЛАТУ - ФИНАЛЬНЫЙ СТАТУС
    newStatus = "Оплачено";
    newText += `\n\n✅ Отписано в оплату — отметил: @${username || fullName}`;
    removeKeyboard = true;
    alertText = "✅ Успешно отмечено как оплачено!";
    isFinalStatus = true;
    shouldDeletePreviousMessage = true;
    console.log("Processing 'paid' action:", { requestId: requests.id, newStatus, username });
  } else if (data === "change_status") {
    // Show status selection keyboard
    const statuses = await getOrganizationStatuses(requests.organization_id);
    
    const keyboard: any[][] = [];
    const displayStatuses = statuses.slice(0, 8);
    
    for (let i = 0; i < displayStatuses.length; i += 2) {
      const row = [];
      row.push({
        text: displayStatuses[i].name,
        callback_data: `status_${i}_${requests.id.substring(0, 20)}`
      });
      if (displayStatuses[i + 1]) {
        row.push({
          text: displayStatuses[i + 1].name,
          callback_data: `status_${i + 1}_${requests.id.substring(0, 20)}`
        });
      }
      keyboard.push(row);
    }
    
    keyboard.push([{ text: "↩️ Назад", callback_data: `back_${requests.id.substring(0, 25)}` }]);
    
    await sendTelegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
    
    await sendTelegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Выберите новый статус",
    });
    return;
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
    // Notify group about status change (only for non-final statuses, final statuses send their own message)
    if (!isFinalStatus) {
      await notifyGroupAboutStatusChange(requests, newStatus, username, fullName);
    }
  }

  // Handle final status: delete ALL previous messages and send new one
  if (shouldDeletePreviousMessage && isFinalStatus) {
    console.log("Final status reached, deleting all previous messages and sending final one");
    
    // Get all message IDs for this request
    const allMessageIds = requests.telegram_message_ids || [];
    console.log("Message IDs to delete:", allMessageIds);
    
    // Delete all previous messages for this request
    for (const msgId of allMessageIds) {
      try {
        await sendTelegramRequest("deleteMessage", {
          chat_id: chatId,
          message_id: msgId,
        });
        console.log("Deleted message:", msgId);
      } catch (error) {
        console.error("Error deleting message:", msgId, error);
      }
    }
    
    // Also try to delete the current message if it's not in the array
    if (!allMessageIds.includes(messageId)) {
      try {
        await sendTelegramRequest("deleteMessage", {
          chat_id: chatId,
          message_id: messageId,
        });
        console.log("Deleted current message:", messageId);
      } catch (error) {
        console.error("Error deleting current message:", error);
      }
    }

    // Send new final message without buttons
    const finalResult = await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: newText,
    });

    // Clear telegram_message_id and telegram_message_ids in database (no more updates needed)
    if (finalResult.ok) {
      await supabase
        .from("requests")
        .update({ 
          telegram_message_id: null,
          telegram_message_ids: []
        })
        .eq("id", requests.id);
      console.log("Cleared all telegram message IDs for request:", requests.id);
    }
  } else {
    // Update existing message (non-final status)
    await sendTelegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      reply_markup: removeKeyboard ? undefined : callbackQuery.message.reply_markup,
    });
  }

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
  const text = validated.text || validated.caption || "";
  const username = validated.from.username || "";
  const fullName = `${validated.from.first_name || ""} ${validated.from.last_name || ""}`.trim();
  const photos = validated.photo;

  console.log("Message from:", username || fullName, "Text:", text, "HasPhoto:", !!photos);

  // Handle bot commands
  if (text && text.startsWith("/")) {
    const command = text.split(" ")[0].toLowerCase();
    
    if (command === "/archive" || command.startsWith("/archive@")) {
      await handleArchiveCommand(chatId);
      return;
    }
    
    if (command === "/help" || command.startsWith("/help@") || command === "/start" || command.startsWith("/start@")) {
      await handleHelpCommand(chatId);
      return;
    }
  }

  // Check for discrepancy description awaiting
  const userIdentifier = username || fullName;
  const { data: discrepancyRequests, error: discError } = await supabase
    .from("requests")
    .select("*")
    .like("awaiting_comment_from", `discrepancy:${userIdentifier}:%`)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!discError && discrepancyRequests && discrepancyRequests.length > 0) {
    const request = discrepancyRequests[0];
    const parts = request.awaiting_comment_from?.split(":") || [];
    const discrepancyType = parts[2] || "Не указан";
    const now = new Date().toLocaleString("ru-RU");
    console.log("Processing discrepancy description for request:", request.id, "type:", discrepancyType);
    
    // Handle photo upload if present
    let photoUrl: string | null = null;
    if (photos && photos.length > 0) {
      const largestPhoto = photos[photos.length - 1];
      try {
        const fileResult = await sendTelegramRequest("getFile", {
          file_id: largestPhoto.file_id,
        });
        
        if (fileResult.ok && fileResult.result?.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileResult.result.file_path}`;
          
          // Add to request photo_urls
          const existingPhotos = request.photo_urls || [];
          await supabase
            .from("requests")
            .update({ photo_urls: [...existingPhotos, photoUrl] })
            .eq("id", request.id);
          console.log("Discrepancy photo saved:", photoUrl);
        }
      } catch (photoError) {
        console.error("Error processing discrepancy photo:", photoError);
      }
    }
    
    // Update comments with discrepancy description
    const existingComments = request.comments || "";
    const discrepancyComment = `🔴 Несоответствие (${discrepancyType}): ${text || "(только фото)"}`;
    const newComments = existingComments 
      ? `${existingComments}\n\n${discrepancyComment}`
      : discrepancyComment;
    
    await supabase
      .from("requests")
      .update({ 
        comments: newComments,
        awaiting_comment_from: null,
      })
      .eq("id", request.id);
    
    // Log activity
    await supabase.from("request_activities").insert({
      request_id: request.id,
      organization_id: request.organization_id,
      action: "discrepancy_description",
      description: `📝 Описание несоответствия (${discrepancyType}): ${text || "(фото)"}${photoUrl ? " + 📷 фото" : ""} — @${userIdentifier}, ${now}`,
    });
    
    // Confirm in chat
    await sendTelegramRequest("sendMessage", {
      chat_id: chatId,
      text: `✅ Несоответствие зафиксировано для заявки ${request.request_number}\n\n📋 Тип: ${discrepancyType}\n📝 Описание: ${text || "(только фото)"}${photoUrl ? "\n📷 Фото приложено" : ""}`,
    });
    
    return;
  }

  // Skip if no text content (e.g. random photo without context)
  if (!text) return;

  // Check if we're waiting for a rework comment from this user
  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("awaiting_comment_from", userIdentifier)
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
      // Notify group about rework status
      await notifyGroupAboutStatusChange(request, "На доработку", username, fullName);
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

  // Verify Telegram secret token - reject unauthorized requests
  if (!TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    console.error("TELEGRAM_WEBHOOK_SECRET_TOKEN not configured");
    return new Response(
      JSON.stringify({ error: "Webhook not properly configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretToken !== TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    console.error("Invalid secret token received");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Webhook request verified with secret token");

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
