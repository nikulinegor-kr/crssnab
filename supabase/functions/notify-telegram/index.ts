import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
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
  const priority = request.priority || "Не указан";
  const status = request.status || "Не указан";
  const transportCompany = request.transport_company || "Не указана";
  const waybillNumber = request.waybill_number || "Не указан";
  const shipmentDate = request.shipment_date ? new Date(request.shipment_date).toLocaleDateString("ru-RU") : "Не указана";
  const deliveryDate = request.delivery_date ? new Date(request.delivery_date).toLocaleDateString("ru-RU") : "Не указана";
  const applicant = request.applicant || "Не указан";
  const comments = request.comments || "Нет";

  return `🧾 Заявка — ${request.description}\n` +
    `${getPriorityEmoji(priority)} Приоритет — ${priority}\n` +
    `${getStatusEmoji(status)} Статус — ${status}\n` +
    `🚛 ТК — ${transportCompany}\n` +
    `📄 № ТТН — ${waybillNumber}\n` +
    `📅 Дата отгрузки — ${shipmentDate}\n` +
    `📅 Дата прибытия — ${deliveryDate}\n` +
    `👤 Заявитель — ${applicant}\n` +
    `📝 Комментарий — ${comments}`;
}

function createKeyboard(request: any) {
  const status = request.status?.toLowerCase() || "";
  const comments = request.comments?.toLowerCase() || "";
  const invoiceNumber = request.invoice_number || "";
  
  const keyboard: any[][] = [];

  // Кнопка ТМЦ ПОЛУЧЕНО
  if (status.includes("доставлено в тк")) {
    keyboard.push([{ text: "📦 ТМЦ ПОЛУЧЕНО", callback_data: "received" }]);
  }

  // Кнопки согласования
  if (comments.includes("требуется согласование")) {
    keyboard.push([{ text: "✅ В РАБОТУ", callback_data: "approve" }]);
    keyboard.push([{ text: "🔧 НА ДОРАБОТКУ", callback_data: "rework" }]);
    keyboard.push([{ text: "❌ ОТКЛОНЕНО", callback_data: "reject" }]);
  }

  // Кнопка открыть счёт
  if (invoiceNumber && (invoiceNumber.startsWith("http://") || invoiceNumber.startsWith("https://"))) {
    keyboard.push([{ text: "📄 Открыть счёт", url: invoiceNumber }]);
  }

  return keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId } = await req.json();

    if (!requestId) {
      throw new Error("requestId is required");
    }

    console.log("Notifying about request:", requestId);

    // Get request details
    const { data: request, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !request) {
      throw new Error("Request not found");
    }

    const message = formatRequestMessage(request);
    const keyboard = createKeyboard(request);

    // Send or update message
    let result;
    if (request.telegram_message_id) {
      // Update existing message
      result = await sendTelegramRequest("editMessageText", {
        chat_id: TELEGRAM_CHAT_ID,
        message_id: request.telegram_message_id,
        text: message,
        reply_markup: keyboard,
      });
    } else {
      // Send new message
      result = await sendTelegramRequest("sendMessage", {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        reply_markup: keyboard,
      });

      // Save message_id to database
      if (result.ok && result.result) {
        await supabase
          .from("requests")
          .update({ telegram_message_id: result.result.message_id })
          .eq("id", requestId);
      }
    }

    console.log("Telegram result:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});