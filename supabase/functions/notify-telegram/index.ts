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

function formatRequestMessage(request: any): string {
  const lines: string[] = [];
  
  // Обязательные поля
  lines.push(`🧾 Заявка — ${request.description}`);
  
  if (request.priority) {
    lines.push(`${getPriorityEmoji(request.priority)} Приоритет — ${request.priority}`);
  }
  
  if (request.status) {
    lines.push(`${getStatusEmoji(request.status)} Статус — ${request.status}`);
  }
  
  // Опциональные поля - показываем только если заполнены
  if (request.applicant) {
    lines.push(`👤 Заявитель — ${request.applicant}`);
  }
  
  if (request.executor) {
    lines.push(`🔧 Исполнитель — ${request.executor}`);
  }
  
  if (request.contractor) {
    lines.push(`🏢 Контрагент — ${request.contractor}`);
  }
  
  if (request.invoice_number) {
    lines.push(`💳 № Счета — ${request.invoice_number}`);
  }
  
  if (request.transport_company) {
    lines.push(`🚛 ТК — ${request.transport_company}`);
  }
  
  if (request.waybill_number) {
    lines.push(`📄 № ТТН — ${request.waybill_number}`);
  }
  
  if (request.shipment_date) {
    lines.push(`📅 Дата отгрузки — ${new Date(request.shipment_date).toLocaleDateString("ru-RU")}`);
  }
  
  if (request.delivery_date) {
    lines.push(`📅 Дата прибытия — ${new Date(request.delivery_date).toLocaleDateString("ru-RU")}`);
  }
  
  if (request.comments) {
    lines.push(`📝 Комментарий — ${request.comments}`);
  }
  
  return lines.join('\n');
}

async function createKeyboard(request: any, supabaseClient: any) {
  const status = request.status?.toLowerCase() || "";
  const comments = request.comments?.toLowerCase() || "";
  const documentUrl = request.document_url || "";
  
  const keyboard: any[][] = [];

  // Кнопка ТМЦ ПОЛУЧЕНО - показываем только если статус "Доставлено в ТК"
  if (status.includes("доставлено в тк")) {
    keyboard.push([{ text: "📦 ТМЦ ПОЛУЧЕНО", callback_data: "received" }]);
  }

  // Кнопки согласования
  if (comments.includes("требуется согласование")) {
    keyboard.push([{ text: "✅ В РАБОТУ", callback_data: "approve" }]);
    keyboard.push([{ text: "🔧 НА ДОРАБОТКУ", callback_data: "rework" }]);
    keyboard.push([{ text: "❌ ОТКЛОНЕНО", callback_data: "reject" }]);
  }

  // Кнопка открыть счёт - используем document_url с signed URL
  if (documentUrl && (documentUrl.startsWith("http://") || documentUrl.startsWith("https://"))) {
    try {
      // Extract file path from URL
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex((p: string) => p === 'request-documents');
      if (bucketIndex !== -1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        
        // Generate signed URL with 24 hour expiry
        const { data, error } = await supabaseClient.storage
          .from('request-documents')
          .createSignedUrl(filePath, 86400);
        
        if (!error && data?.signedUrl) {
          keyboard.push([{ text: "📄 Открыть счёт", url: data.signedUrl }]);
        } else {
          console.error('Error creating signed URL:', error);
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
    
    // Validate input
    const schema = z.object({
      requestId: z.string().uuid(),
      mode: z.enum(["auto", "send", "edit"]).optional().default("auto"),
    });
    
    const { requestId, mode } = schema.parse(requestBody);
    console.log("Notifying about request:", requestId, "mode:", mode);

    // Get request details with organization info
    const { data: request, error } = await supabase
      .from("requests")
      .select(`
        *,
        organizations!inner(telegram_bot_token, telegram_chat_id)
      `)
      .eq("id", requestId)
      .single();

    if (error || !request) {
      return new Response(
        JSON.stringify({ error: "Заявка не найдена" }),
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
    const org = request.organizations;
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

    const message = formatRequestMessage(request);
    const keyboard = await createKeyboard(request, supabase);

    // Send or update message based on mode
    let result;
    const shouldEdit = request.telegram_message_id && mode !== "send";
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
    } else {
      // Send new message
      result = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
        chat_id: org.telegram_chat_id,
        text: message,
        reply_markup: keyboard,
      });

      // Save message_id to database (track the latest message)
      if (result.ok && result.result) {
        await supabase
          .from("requests")
          .update({ telegram_message_id: result.result.message_id })
          .eq("id", requestId);
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