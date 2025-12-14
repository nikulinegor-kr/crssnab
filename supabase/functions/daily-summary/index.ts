import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegramRequest(botToken: string, method: string, body: any) {
  console.log(`Sending Telegram request: ${method}`, JSON.stringify(body, null, 2));
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  console.log(`Telegram response:`, JSON.stringify(result, null, 2));
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function sendDailySummary(orgId: string, botToken: string, chatId: string) {
  console.log(`Sending daily summary for organization: ${orgId}`);

  // Get requests with status "Доставлено в ТК" 
  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .eq("organization_id", orgId)
    .eq("archived", false)
    .ilike("status", "%доставлено в тк%")
    .order("delivery_date", { ascending: true });

  if (error) {
    console.error("Error fetching requests:", error);
    return { success: false, error: error.message };
  }

  console.log(`Found ${requests?.length || 0} requests with "Доставлено в ТК" status`);

  if (!requests || requests.length === 0) {
    // No requests to report
    const message = `📊 Ежедневная сводка на ${formatDate(new Date())}\n\n` +
      `✅ Нет заявок со статусом "Доставлено в ТК"`;
    
    await sendTelegramRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: message,
    });
    
    return { success: true, count: 0 };
  }

  // Build summary message
  let message = `📊 Ежедневная сводка на ${formatDate(new Date())}\n\n`;
  message += `📦 Заявки со статусом "Доставлено в ТК": ${requests.length}\n\n`;

  requests.forEach((req, index) => {
    message += `${index + 1}. ${req.description}\n`;
    if (req.transport_company) {
      message += `   🚛 ТК: ${req.transport_company}\n`;
    }
    if (req.delivery_date) {
      message += `   📅 Ожидаемая доставка: ${formatDate(new Date(req.delivery_date))}\n`;
    }
    if (req.applicant) {
      message += `   👤 Заявитель: ${req.applicant}\n`;
    }
    message += "\n";
  });

  // Create inline keyboard with quick actions
  const keyboard = {
    inline_keyboard: requests.slice(0, 10).map(req => ([
      { 
        text: `📦 ${req.description.substring(0, 30)}${req.description.length > 30 ? '...' : ''}`, 
        callback_data: `summary_view_${req.id.substring(0, 30)}` 
      },
      { 
        text: "✅ Получено", 
        callback_data: `summary_received_${req.id.substring(0, 25)}` 
      }
    ]))
  };

  const result = await sendTelegramRequest(botToken, "sendMessage", {
    chat_id: chatId,
    text: message,
    reply_markup: requests.length > 0 ? keyboard : undefined,
  });

  return { success: result.ok, count: requests.length };
}

serve(async (req) => {
  console.log("=== DAILY SUMMARY FUNCTION CALLED ===");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get all organizations with Telegram configured
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, telegram_bot_token, telegram_chat_id")
      .not("telegram_bot_token", "is", null)
      .not("telegram_chat_id", "is", null);

    if (orgError) {
      console.error("Error fetching organizations:", orgError);
      return new Response(
        JSON.stringify({ error: orgError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${organizations?.length || 0} organizations with Telegram configured`);

    const results: any[] = [];

    for (const org of organizations || []) {
      if (org.telegram_bot_token && org.telegram_chat_id) {
        console.log(`Processing organization: ${org.name} (${org.id})`);
        const result = await sendDailySummary(
          org.id, 
          org.telegram_bot_token, 
          org.telegram_chat_id
        );
        results.push({
          organization: org.name,
          ...result
        });
      }
    }

    console.log("Daily summary completed:", results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in daily-summary function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});