import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Hardcoded routing groups (per business rules)
const INCOMING_REQUESTS_CHAT_ID = "-5268728373";       // first notification (status "Входящая заявка")
const NEW_REQUESTS_CHAT_ID = "-1003141855190";         // after executor is assigned

/** Fetch telegram credentials from the dedicated telegram_settings table */
async function getTelegramSettings(orgId: string) {
  const { data, error } = await supabase
    .from("telegram_settings")
    .select("bot_token, chat_id, auto_send_on_create, auto_send_on_status_change, invoice_chat_id, procurement_chat_id, auto_send_to_procurement")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    telegram_bot_token: data.bot_token,
    telegram_chat_id: data.chat_id,
    telegram_auto_send_on_create: data.auto_send_on_create,
    telegram_auto_send_on_status_change: data.auto_send_on_status_change,
    telegram_invoice_chat_id: data.invoice_chat_id,
    telegram_procurement_chat_id: data.procurement_chat_id,
    telegram_auto_send_to_procurement: data.auto_send_to_procurement,
  };
}

async function sendTelegramRequest(botToken: string, method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await response.json();
}

function getPriorityEmoji(priority: string): string {
  const p = priority?.toLowerCase() || "";
  if (p.includes("авар")) return "🚨";
  if (p.includes("срочн")) return "⚡";
  return "⭐";
}

function getStatusEmoji(status: string): string {
  const s = status?.toLowerCase() || "";
  if (s.includes("доставлено")) return "✅";
  if (s.includes("работ")) return "🔧";
  if (s.includes("отклонено")) return "❌";
  if (s.includes("новая")) return "🆕";
  return "🚚";
}

function formatRequestMessage(request: any, participants: any[] = []): string {
  const lines: string[] = [];
  const status = request.status?.toLowerCase() || "";
  
  // Helper to get telegram username for applicant
  const getApplicantTelegram = (name: string): string | null => {
    if (!name) return null;
    const participant = participants.find(
      p => p.name === name && p.participant_type === "applicant"
    );
    return participant?.telegram_username ? `@${participant.telegram_username}` : null;
  };
  
  // Специальный формат для статуса "В пути"
  if (status.includes("в пути")) {
    // Блок 1: Описание
    lines.push(`🧾 Заявка — ${request.description}`);
    
    // Блок 2: Приоритет и Статус
    lines.push("");
    if (request.priority) {
      lines.push(`${getPriorityEmoji(request.priority)} Приоритет — ${request.priority}`);
    }
    lines.push(`🚚 Статус — ${request.status}`);
    
    // Блок 3: Заявитель
    if (request.applicant) {
      lines.push("");
      lines.push(`👤 Заявитель — ${request.applicant}`);
    }
    
    // Блок 4: Логистика
    const logisticsBlock: string[] = [];
    if (request.transport_company) {
      logisticsBlock.push(`🚛 ТК — ${request.transport_company}`);
    }
    if (request.shipment_date) {
      logisticsBlock.push(`📅 Дата отгрузки — ${new Date(request.shipment_date).toLocaleDateString("ru-RU")}`);
    }
    if (request.delivery_date) {
      logisticsBlock.push(`📅 Дата прибытия — ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}`);
    }
    if (logisticsBlock.length > 0) {
      lines.push("");
      lines.push(...logisticsBlock);
    }
    
    // Телеграм-упоминание в самом конце
    const telegramMention = getApplicantTelegram(request.applicant);
    if (telegramMention) {
      lines.push("");
      lines.push(telegramMention);
    }
    
    return lines.join('\n');
  }
  
  // Специальный формат для статуса "Доставлено"
  if (status.includes("доставлено") && !status.includes("доставлено в тк")) {
    // Блок 1: Описание
    lines.push(`🧾 Заявка — ${request.description}`);
    
    // Блок 2: Приоритет и Статус
    lines.push("");
    if (request.priority) {
      lines.push(`${getPriorityEmoji(request.priority)} Приоритет — ${request.priority}`);
    }
    lines.push(`✅ Статус — ${request.status}`);
    
    // Блок 3: Заявитель
    if (request.applicant) {
      lines.push("");
      lines.push(`👤 Заявитель — ${request.applicant}`);
    }
    
    // Блок 4: Логистика
    const logisticsBlock: string[] = [];
    if (request.transport_company) {
      logisticsBlock.push(`🚛 ТК — ${request.transport_company}`);
    }
    if (request.delivery_date) {
      logisticsBlock.push(`📅 Дата прибытия — ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}`);
    }
    if (logisticsBlock.length > 0) {
      lines.push("");
      lines.push(...logisticsBlock);
    }
    
    // Телеграм-упоминание в самом конце
    const telegramMention = getApplicantTelegram(request.applicant);
    if (telegramMention) {
      lines.push("");
      lines.push(telegramMention);
    }
    
    return lines.join('\n');
  }
  
  // Специальный формат для статуса "Доставлено в ТК"
  if (status.includes("доставлено в тк")) {
    // Блок 1: Описание
    lines.push(`🧾 Заявка — ${request.description}`);
    
    // Блок 2: Приоритет и Статус
    lines.push("");
    if (request.priority) {
      lines.push(`${getPriorityEmoji(request.priority)} Приоритет — ${request.priority}`);
    }
    lines.push(`📦 Статус — ${request.status}`);
    
    // Блок 3: Заявитель
    if (request.applicant) {
      lines.push("");
      lines.push(`👤 Заявитель — ${request.applicant}`);
    }
    
    // Блок 4: Логистика
    const logisticsBlock: string[] = [];
    if (request.transport_company) {
      logisticsBlock.push(`🚛 ТК — ${request.transport_company}`);
    }
    if (request.delivery_date) {
      logisticsBlock.push(`📅 Дата прибытия — ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}`);
    }
    if (logisticsBlock.length > 0) {
      lines.push("");
      lines.push(...logisticsBlock);
    }
    
    // Телеграм-упоминание в самом конце
    const telegramMention = getApplicantTelegram(request.applicant);
    if (telegramMention) {
      lines.push("");
      lines.push(telegramMention);
    }
    
    return lines.join('\n');
  }
  
  // Стандартный формат для остальных статусов
  // Блок 1: Описание
  lines.push(`🧾 Заявка: ${request.description}`);
  
  // Блок 2: Приоритет и Статус
  const block2: string[] = [];
  if (request.priority) {
    block2.push(`${getPriorityEmoji(request.priority)} Приоритет: ${request.priority}`);
  }
  if (request.status) {
    block2.push(`${getStatusEmoji(request.status)} Статус: ${request.status}`);
  }
  if (block2.length > 0) {
    lines.push("");
    lines.push(...block2);
  }
  
  // Блок 3: Заявитель и Исполнитель
  const block3: string[] = [];
  if (request.applicant) {
    block3.push(`👤 Заявитель: ${request.applicant}`);
  }
  if (request.executor) {
    block3.push(`🔧 Исполнитель: ${request.executor}`);
  }
  if (block3.length > 0) {
    lines.push("");
    lines.push(...block3);
  }
  
  // Блок 4: Контрагент и Счёт
  const block4: string[] = [];
  if (request.contractor) {
    block4.push(`🏢 Контрагент: ${request.contractor}`);
  }
  if (request.invoice_number) {
    block4.push(`📄 № счёта: ${request.invoice_number}`);
  }
  if (block4.length > 0) {
    lines.push("");
    lines.push(...block4);
  }
  
  // Блок 5: Логистика
  const block5: string[] = [];
  if (request.transport_company) {
    block5.push(`🚛 ТК: ${request.transport_company}`);
  }
  if (request.waybill_number) {
    block5.push(`📄 № ТТН: ${request.waybill_number}`);
  }
  if (request.shipment_date) {
    block5.push(`📅 Дата отгрузки: ${new Date(request.shipment_date).toLocaleDateString("ru-RU")}`);
  }
  if (request.delivery_date) {
    block5.push(`📅 Дата прибытия: ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}`);
  }
  if (block5.length > 0) {
    lines.push("");
    lines.push(...block5);
  }
  
  // Блок 6: Комментарий
  if (request.comments) {
    lines.push("");
    lines.push(`📝 Комментарий: ${request.comments}`);
  }
  
  // Телеграм-упоминание в самом конце
  const telegramMention = getApplicantTelegram(request.applicant);
  if (telegramMention) {
    lines.push("");
    lines.push(telegramMention);
  }
  
  return lines.join('\n');
}

async function createKeyboard(request: any, supabaseClient: any) {
  const status = request.status?.toLowerCase() || "";
  const comments = request.comments?.toLowerCase() || "";
  // Check both singular and array document fields
  const allDocUrls = (request.document_urls?.length > 0 ? request.document_urls : (request.document_url ? [request.document_url] : []));
  const documentUrl = allDocUrls[0] || "";
  
  const keyboard: any[][] = [];

  // Кнопка Получение подтверждено - показываем только если статус "Доставлено в ТК"
  if (status.includes("доставлено в тк")) {
    keyboard.push([{ text: "📦 Получение подтверждено", callback_data: "received" }]);
  }

  // Кнопки согласования
  if (comments.includes("требуется согласование")) {
    keyboard.push([{ text: "✅ В РАБОТУ", callback_data: "approve" }]);
    keyboard.push([{ text: "🔧 НА ДОРАБОТКУ", callback_data: "rework" }]);
    keyboard.push([{ text: "❌ ОТКЛОНЕНО", callback_data: "reject" }]);
  }

  // Кнопка "Отписано в оплату" убрана из основного чата — используется только в чате счетов

  // Кнопки для статуса "Счёт в Бухгалтерии"
  if (status.includes("счёт в бухгалтерии")) {
    // Кнопка открыть счёт
    if (documentUrl && (documentUrl.startsWith("http://") || documentUrl.startsWith("https://"))) {
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
        keyboard.push([{ text: "📄 Открыть счёт", url: documentUrl }]);
      }
    }
    // Кнопки оплаты и доработки
    keyboard.push([{ text: "✅ Отписать в оплату", callback_data: `inv_a_${request.id}` }]);
    keyboard.push([{ text: "🔧 На доработку", callback_data: `inv_r_${request.id}` }]);
  }


  return keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);

    if (!authHeader) {
      console.error("No Authorization header");
      return new Response(
        JSON.stringify({ error: "Требуется авторизация" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from the authorization token
    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);

    // Use service role to verify the user's JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: `Ошибка авторизации: ${userError.message}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user) {
      console.error("No user found");
      return new Response(
        JSON.stringify({ error: "Пользователь не найден" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    const requestBody = await req.json();

    // Handle ZRS document sending
    if (requestBody.action === "send_zrs_document") {
      const { organization_id, document_url, file_name, caption } = requestBody;
      if (!organization_id || !document_url) {
        return new Response(
          JSON.stringify({ error: "Не указаны обязательные параметры" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const org = await getTelegramSettings(organization_id);

      if (!org?.telegram_bot_token || !org?.telegram_chat_id) {
        return new Response(
          JSON.stringify({ error: "Telegram не настроен для организации" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate signed URL for the document
      let signedDocUrl = document_url;
      try {
        const url = new URL(document_url);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          const { data: signedData } = await supabase.storage
            .from('request-documents')
            .createSignedUrl(filePath, 86400);
          if (signedData?.signedUrl) signedDocUrl = signedData.signedUrl;
        }
      } catch (e) {
        console.error("Error creating signed URL for ZRS:", e);
      }

      const result = await sendTelegramRequest(org.telegram_bot_token, "sendDocument", {
        chat_id: org.telegram_chat_id,
        document: signedDocUrl,
        caption: caption || `📋 ${file_name || "Счёт с ЗРС"}`,
        parse_mode: "HTML",
      });

      return new Response(JSON.stringify({ success: result.ok, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle test personal message
    if (requestBody.action === "test_personal") {
      const { telegramUserId, organizationId } = requestBody;
      if (!telegramUserId || !organizationId) {
        return new Response(
          JSON.stringify({ error: "Не указаны обязательные параметры" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const org = await getTelegramSettings(organizationId);
      if (!org?.telegram_bot_token) {
        return new Response(
          JSON.stringify({ error: "Telegram бот не настроен для организации" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
        chat_id: telegramUserId,
        text: "✅ Тестовое сообщение\n\nВаш Telegram успешно подключён к системе уведомлений.",
        parse_mode: "HTML",
      });

      if (!result.ok) {
        return new Response(
          JSON.stringify({ success: false, error: result.description || "Не удалось отправить сообщение. Убедитесь, что вы начали диалог с ботом." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle send to invoice chat only
    if (requestBody.action === "send_to_invoice_chat") {
      const { requestId } = requestBody;
      if (!requestId) {
        return new Response(
          JSON.stringify({ error: "Не указан requestId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: req, error: reqErr } = await supabase
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (reqErr || !req) {
        return new Response(
          JSON.stringify({ error: "Заявка не найдена" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const reqOrg = await getTelegramSettings(req.organization_id);
      if (!reqOrg?.telegram_bot_token || !reqOrg?.telegram_invoice_chat_id) {
        return new Response(
          JSON.stringify({ error: "Telegram Buh чат не настроен" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build invoice message
      const invoiceLines: string[] = [];
      invoiceLines.push(`💰 Счёт на оплату`);
      invoiceLines.push("");
      invoiceLines.push(`🧾 Заявка — ${req.description}`);
      if (req.contractor) invoiceLines.push(`🏢 Контрагент — ${req.contractor}`);
      if (req.invoice_number) invoiceLines.push(`📄 № счёта — ${req.invoice_number}`);
      if (req.amount) invoiceLines.push(`💵 Сумма — ${Number(req.amount).toLocaleString("ru-RU")} ₽`);
      if (req.payment_percentage != null) invoiceLines.push(`📊 Оплата — ${req.payment_percentage}%`);
      if (req.payment_status) invoiceLines.push(`📋 Статус оплаты — ${req.payment_status}`);
      if (req.applicant) {
        invoiceLines.push("");
        invoiceLines.push(`👤 Заявитель — ${req.applicant}`);
      }

      const invoiceKeyboard = {
        inline_keyboard: [
          [{ text: "✅ Отписать в оплату", callback_data: `inv_a_${requestId}` }],
          [{ text: "🔧 На доработку", callback_data: `inv_r_${requestId}` }],
        ]
      };

      const sendResult = await sendTelegramRequest(reqOrg.telegram_bot_token, "sendMessage", {
        chat_id: reqOrg.telegram_invoice_chat_id,
        text: invoiceLines.join("\n"),
        reply_markup: invoiceKeyboard,
      });

      // Also send document files
      const docUrls = (req.document_urls?.length > 0 ? req.document_urls : (req.document_url ? [req.document_url] : []));
      console.log("Invoice chat - document URLs to send:", docUrls.length, docUrls);
      for (const docUrl of docUrls) {
        if (docUrl && (docUrl.startsWith("http://") || docUrl.startsWith("https://"))) {
          try {
            let finalDocUrl = docUrl;
            try {
              const url = new URL(docUrl);
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
              if (bucketIndex !== -1) {
                const filePath = pathParts.slice(bucketIndex + 1).join('/');
                const { data: signedData } = await supabase.storage
                  .from('request-documents')
                  .createSignedUrl(filePath, 86400);
                if (signedData?.signedUrl) finalDocUrl = signedData.signedUrl;
              }
            } catch (e) { /* use original */ }

            await sendTelegramRequest(reqOrg.telegram_bot_token, "sendDocument", {
              chat_id: reqOrg.telegram_invoice_chat_id,
              document: finalDocUrl,
              caption: `📄 Счёт к заявке: ${req.description?.substring(0, 100) || ''}`,
            });
          } catch (e) {
            console.error("Error sending doc to invoice chat:", e);
          }
        }
      }

      return new Response(JSON.stringify({ success: sendResult.ok, result: sendResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate input for standard request notification
    const schema = z.object({
      requestId: z.string().uuid(),
      mode: z.enum(["auto", "send", "edit"]).optional().default("auto"),
    });
    
    const { requestId, mode } = schema.parse(requestBody);
    console.log("Notifying about request:", requestId, "mode:", mode);

    // Get request details
    console.log("Fetching request:", requestId);
    const { data: request, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    console.log("Request query result - data:", !!request, "error:", error ? JSON.stringify(error) : "none");

    if (error || !request) {
      return new Response(
        JSON.stringify({ error: "Заявка не найдена", details: error?.message || "no data returned" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", request.organization_id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Недостаточно прав для отправки уведомлений" 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if organization has Telegram configured
    const org = await getTelegramSettings(request.organization_id);
    if (!org?.telegram_bot_token || !org?.telegram_chat_id) {
      console.log("Telegram not configured for this organization");
      return new Response(
        JSON.stringify({ 
          error: "Telegram не настроен для этой организации. Перейдите в Настройки → Интеграции → Telegram" 
        }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get participants for mentions
    const { data: participants } = await supabase
      .from("request_participants")
      .select("name, telegram_username, participant_type")
      .eq("organization_id", request.organization_id)
      .eq("is_active", true);

    const message = formatRequestMessage(request, participants || []);
    const keyboard = await createKeyboard(request, supabase);

    // Delete all previous messages for this request before sending new one
    const existingMessageIds = request.telegram_message_ids || [];
    if (existingMessageIds.length > 0 && mode === "send") {
      console.log("Deleting previous messages:", existingMessageIds);
      for (const msgId of existingMessageIds) {
        try {
          await sendTelegramRequest(org.telegram_bot_token, "deleteMessage", {
            chat_id: org.telegram_chat_id,
            message_id: msgId,
          });
          console.log("Deleted message:", msgId);
        } catch (error) {
          console.error("Error deleting message:", msgId, error);
        }
      }
    }

    // Detect "incoming" request — these are routed ONLY to the incoming-requests group
    const isIncomingRequest = (request.status || "").toLowerCase().includes("входящая");

    // Send or update message based on mode
    let result;
    const shouldEdit = request.telegram_message_id && mode !== "send" && !isIncomingRequest;
    if (shouldEdit) {
      // Update existing message
      result = await sendTelegramRequest(org.telegram_bot_token, "editMessageText", {
        chat_id: org.telegram_chat_id,
        message_id: request.telegram_message_id,
        text: message,
        reply_markup: keyboard,
      });
      
      // Handle "message is not modified" error - this is not a real error
      if (!result.ok && result.error_code === 400 && 
          result.description?.includes("message is not modified")) {
        console.log("Message content unchanged, skipping update");
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true,
            message: "Сообщение не изменилось" 
          }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!isIncomingRequest) {
      // Send new message to MAIN chat (only for non-incoming requests)
      result = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
        chat_id: org.telegram_chat_id,
        text: message,
        reply_markup: keyboard,
      });

      // Save message_id to database (replace array with just the new message)
      if (result.ok && result.result) {
        const newMessageId = result.result.message_id;
        await supabase
          .from("requests")
          .update({ 
            telegram_message_id: newMessageId,
            telegram_message_ids: [newMessageId]
          })
          .eq("id", requestId);
      }
    } else {
      result = { ok: true, skipped_main: true };
    }

    // ===== INCOMING REQUESTS GROUP: send to hardcoded incoming chat when status is "Входящая заявка" =====
    if (isIncomingRequest) {
      const procurementChatId = INCOMING_REQUESTS_CHAT_ID;
      console.log("Sending to incoming requests chat:", procurementChatId);

      // Get equipment info if available
      let equipmentInfo = "";
      if (request.equipment_id) {
        const { data: eq } = await supabase
          .from("equipment")
          .select("brand, model, plate_number")
          .eq("id", request.equipment_id)
          .maybeSingle();
        if (eq) {
          equipmentInfo = [eq.brand, eq.model, eq.plate_number].filter(Boolean).join(" / ");
        }
      }

      // Get object name
      let objectName = "";
      if (request.object_id) {
        const { data: obj } = await supabase
          .from("request_objects")
          .select("name")
          .eq("id", request.object_id)
          .maybeSingle();
        if (obj) objectName = obj.name;
      }

      // Build incoming message
      const procLines: string[] = [];
      procLines.push(`📥 Входящая заявка`);
      procLines.push("");
      procLines.push(`📅 ${new Date().toLocaleDateString("ru-RU")}`);
      procLines.push(`🧾 ${request.description || "Без описания"}`);
      if (request.quantity) procLines.push(`📦 Кол-во: ${request.quantity}`);
      if (objectName) procLines.push(`🏗 Объект: ${objectName}`);
      if (equipmentInfo) procLines.push(`🚜 Техника: ${equipmentInfo}`);
      if (request.priority) procLines.push(`${getPriorityEmoji(request.priority)} Приоритет: ${request.priority}`);
      if (request.applicant) procLines.push(`👤 Заявитель: ${request.applicant}`);

      // Avoid duplicate: only send once per request
      if (!request.telegram_procurement_message_id) {
        const procKeyboard = {
          inline_keyboard: [
            [{ text: "👷 Назначить исполнителя", callback_data: `assign_exec_${requestId}` }],
          ]
        };

        const procResult = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
          chat_id: procurementChatId,
          text: procLines.join("\n"),
          reply_markup: procKeyboard,
        });

        if (procResult.ok && procResult.result) {
          await supabase
            .from("requests")
            .update({ telegram_procurement_message_id: procResult.result.message_id })
            .eq("id", requestId);
        }
        console.log("Incoming chat send result:", JSON.stringify(procResult));
      } else {
        console.log("Incoming message already sent for this request, skipping duplicate");
      }
    }

    if (result.ok && result.result && !isIncomingRequest) {

        // Send invoice to separate chat if configured and status is "Счёт в Бухгалтерии"
        const invoiceChatId = org.telegram_invoice_chat_id;
        const invoiceStatus = request.status?.toLowerCase() || "";
        const isInvoiceStatusForChat = invoiceStatus.includes("счёт в бухгалтерии") || invoiceStatus.includes("счет в бухгалтерии");
        if (invoiceChatId && isInvoiceStatusForChat) {
          console.log("Sending invoice notification to separate chat:", invoiceChatId);
          
          const invoiceLines: string[] = [];
          invoiceLines.push(`💰 Счёт на оплату`);
          invoiceLines.push("");
          invoiceLines.push(`🧾 Заявка — ${request.description}`);
          if (request.contractor) {
            invoiceLines.push(`🏢 Контрагент — ${request.contractor}`);
          }
          invoiceLines.push(`📄 № счёта — ${request.invoice_number}`);
          if (request.amount) {
            invoiceLines.push(`💵 Сумма — ${Number(request.amount).toLocaleString("ru-RU")} ₽`);
          }
          if (request.payment_percentage != null) {
            invoiceLines.push(`📊 Оплата — ${request.payment_percentage}%`);
          }
          if (request.payment_status) {
            invoiceLines.push(`📋 Статус оплаты — ${request.payment_status}`);
          }
          if (request.applicant) {
            invoiceLines.push("");
            invoiceLines.push(`👤 Заявитель — ${request.applicant}`);
          }
          
          const invoiceMessage = invoiceLines.join("\n");
          
          // Add inline keyboard with payment buttons
          const invoiceKeyboard = {
            inline_keyboard: [
              [{ text: "✅ Отписать в оплату", callback_data: `inv_a_${requestId}` }],
              [{ text: "🔧 На доработку", callback_data: `inv_r_${requestId}` }],
            ]
          };
          
          const invoiceSendResult = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
            chat_id: invoiceChatId,
            text: invoiceMessage,
            reply_markup: invoiceKeyboard,
          });
          console.log("Invoice chat send result:", JSON.stringify(invoiceSendResult));

          // Also send document files to invoice chat if available
          const invoiceDocUrls = (request.document_urls?.length > 0 ? request.document_urls : (request.document_url ? [request.document_url] : []));
          console.log("Auto invoice chat - document URLs to send:", invoiceDocUrls.length, JSON.stringify(invoiceDocUrls));
          for (const docUrl of invoiceDocUrls) {
            if (docUrl && (docUrl.startsWith("http://") || docUrl.startsWith("https://"))) {
              try {
                let finalDocUrl = docUrl;
                try {
                  const url = new URL(docUrl);
                  const pathParts = url.pathname.split('/');
                  const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
                  if (bucketIndex !== -1) {
                    const filePath = pathParts.slice(bucketIndex + 1).join('/');
                    const { data: signedData } = await supabase.storage
                      .from('request-documents')
                      .createSignedUrl(filePath, 86400);
                    if (signedData?.signedUrl) finalDocUrl = signedData.signedUrl;
                  }
                } catch (e) { /* use original */ }

                await sendTelegramRequest(org.telegram_bot_token, "sendDocument", {
                  chat_id: invoiceChatId,
                  document: finalDocUrl,
                  caption: `📄 Счёт к заявке: ${request.description?.substring(0, 100) || ''}`,
                });
              } catch (e) {
                console.error("Error sending invoice doc to separate chat:", e);
              }
            }
          }
        }
        
        // Документы (PDF и т.п.) теперь отправляются ВСЕГДА, если они есть.
        // Фото по-прежнему уходят только в статусе "Счёт в Бухгалтерии".
        const status = request.status?.toLowerCase() || "";
        const isInvoiceStatus = status.includes("счёт в бухгалтерии") || status.includes("счет в бухгалтерии");

        {

          // Send documents as separate files
          const documentUrls = (request.document_urls?.length > 0 ? request.document_urls : (request.document_url ? [request.document_url] : []));
          console.log("Main chat - document URLs to send:", documentUrls.length, JSON.stringify(documentUrls));
          
          if (documentUrls.length > 0) {
            console.log("Status is 'Счёт в Бухгалтерии', sending document files:", documentUrls.length);
            
            for (const docUrl of documentUrls) {
              if (docUrl && (docUrl.startsWith("http://") || docUrl.startsWith("https://"))) {
                try {
                  // Try to generate a signed URL for the document
                  let finalDocUrl = docUrl;
                  try {
                    const url = new URL(docUrl);
                    const pathParts = url.pathname.split('/');
                    const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
                    if (bucketIndex !== -1) {
                      const filePath = pathParts.slice(bucketIndex + 1).join('/');
                      const { data: signedData, error: signedError } = await supabase.storage
                        .from('request-documents')
                        .createSignedUrl(filePath, 86400);
                      if (!signedError && signedData?.signedUrl) {
                        finalDocUrl = signedData.signedUrl;
                        console.log("Using signed URL for document");
                      }
                    }
                  } catch (e) {
                    console.log("Could not generate signed URL, using original:", e);
                  }

                  // Get file name from URL
                  const urlParts = docUrl.split('/');
                  let fileName = urlParts[urlParts.length - 1] || 'document';
                  try {
                    fileName = decodeURIComponent(fileName);
                  } catch (e) {
                    // Keep original if decode fails
                  }
                  
                  // Send document via Telegram
                  const docResult = await sendTelegramRequest(org.telegram_bot_token, "sendDocument", {
                    chat_id: org.telegram_chat_id,
                    document: finalDocUrl,
                    caption: `📄 Счёт к заявке: ${request.description?.substring(0, 100) || 'Без описания'}`,
                  });
                  
                  if (docResult.ok) {
                    console.log("Document sent successfully:", fileName);
                  } else {
                    console.error("Error sending document:", docResult);
                  }
                } catch (docError) {
                  console.error("Error processing document:", docError);
                }
              }
            }
          }

          // Фото оставляем только для статуса "Счёт в Бухгалтерии"
          if (isInvoiceStatus) {
            const photoUrls = (request.photo_urls?.length > 0 ? request.photo_urls : (request.photo_url ? [request.photo_url] : []));

            if (photoUrls.length > 0) {
              console.log("Status is 'Счёт в Бухгалтерии', sending photo files:", photoUrls.length);

              for (const photoUrl of photoUrls) {
                if (photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
                  try {
                    let finalPhotoUrl = photoUrl;
                    try {
                      const url = new URL(photoUrl);
                      const pathParts = url.pathname.split('/');
                      const bucketIndex = pathParts.findIndex((p: string) => p === 'request-photos');
                      if (bucketIndex !== -1) {
                        const filePath = pathParts.slice(bucketIndex + 1).join('/');
                        const { data: signedData, error: signedError } = await supabase.storage
                          .from('request-photos')
                          .createSignedUrl(filePath, 86400);
                        if (!signedError && signedData?.signedUrl) {
                          finalPhotoUrl = signedData.signedUrl;
                        }
                      }
                    } catch (e) {
                      console.log("Could not generate signed URL for photo, using original:", e);
                    }

                    const photoResult = await sendTelegramRequest(org.telegram_bot_token, "sendPhoto", {
                      chat_id: org.telegram_chat_id,
                      photo: finalPhotoUrl,
                      caption: `📷 Фото к заявке: ${request.description?.substring(0, 100) || 'Без описания'}`,
                    });

                    if (!photoResult.ok) {
                      console.error("Error sending photo:", photoResult);
                    }
                  } catch (photoError) {
                    console.error("Error processing photo:", photoError);
                  }
                }
              }
            }
          }
        }

    }

    console.log("Telegram result:", result);
    
    // Check for other errors
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Ошибка Telegram API: ${result.description || 'Неизвестная ошибка'}` 
        }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-telegram function:", error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Некорректные данные запроса" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Не удалось отправить уведомление" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});