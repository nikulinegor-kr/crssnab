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

function formatReminderMessage(request: any, participants: any[] = []): string {
  const lines: string[] = [];

  const getApplicantTelegram = (name: string): string | null => {
    if (!name) return null;
    const participant = participants.find(
      (p: any) => p.name === name && p.participant_type === "applicant"
    );
    return participant?.telegram_username ? `@${participant.telegram_username}` : null;
  };

  lines.push(`🔔 Напоминание: подтвердите получение!`);
  lines.push("");
  lines.push(`🧾 Заявка — ${request.description}`);

  lines.push("");
  if (request.priority) {
    lines.push(`${getPriorityEmoji(request.priority)} Приоритет — ${request.priority}`);
  }
  lines.push(`📦 Статус — ${request.status}`);

  if (request.applicant) {
    lines.push("");
    lines.push(`👤 Заявитель — ${request.applicant}`);
  }

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

  const telegramMention = getApplicantTelegram(request.applicant);
  if (telegramMention) {
    lines.push("");
    lines.push(telegramMention);
  }

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for unconfirmed 'Доставлено в ТК' requests older than 24h...");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find requests still in "Доставлено в ТК" status
    const { data: requests, error: reqError } = await supabase
      .from("requests")
      .select(`
        id, description, status, priority, applicant, executor,
        transport_company, delivery_date, organization_id, request_number,
        telegram_message_id, telegram_message_ids,
        organizations!inner(telegram_bot_token, telegram_chat_id)
      `)
      .eq("status", "Доставлено в ТК")
      .eq("archived", false);

    if (reqError) {
      console.error("Error fetching requests:", reqError);
      return new Response(JSON.stringify({ error: reqError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!requests || requests.length === 0) {
      console.log("No requests in 'Доставлено в ТК' status");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const request of requests) {
      const org = (request as any).organizations;
      if (!org?.telegram_bot_token || !org?.telegram_chat_id) continue;

      // Check when status was changed to "Доставлено в ТК"
      const { data: statusActivity } = await supabase
        .from("request_activities")
        .select("created_at")
        .eq("request_id", request.id)
        .eq("action", "status_changed")
        .eq("new_value", "Доставлено в ТК")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!statusActivity || statusActivity.length === 0) continue;

      const statusChangedAt = new Date(statusActivity[0].created_at);
      if (statusChangedAt.toISOString() > twentyFourHoursAgo) {
        // Less than 24 hours have passed
        continue;
      }

      // Check if already confirmed (received_confirmed activity exists)
      const { data: confirmedActivity } = await supabase
        .from("request_activities")
        .select("id")
        .eq("request_id", request.id)
        .eq("action", "received_confirmed")
        .limit(1);

      if (confirmedActivity && confirmedActivity.length > 0) {
        // Already confirmed, skip
        continue;
      }

      // Check if reminder was already sent within last 24h (avoid spamming)
      const { data: reminderActivity } = await supabase
        .from("request_activities")
        .select("id")
        .eq("request_id", request.id)
        .eq("action", "delivery_reminder_sent")
        .gte("created_at", twentyFourHoursAgo)
        .limit(1);

      if (reminderActivity && reminderActivity.length > 0) {
        // Reminder already sent within last 24h
        continue;
      }

      // Get participants for mentions
      const { data: participants } = await supabase
        .from("request_participants")
        .select("name, telegram_username, participant_type")
        .eq("organization_id", request.organization_id)
        .eq("is_active", true);

      const message = formatReminderMessage(request, participants || []);

      const keyboard = {
        inline_keyboard: [
          [{ text: "📦 Получение подтверждено", callback_data: "received" }],
        ],
      };

      // Delete previous messages for this request
      const existingMessageIds = request.telegram_message_ids || [];
      for (const msgId of existingMessageIds) {
        try {
          await sendTelegramRequest(org.telegram_bot_token, "deleteMessage", {
            chat_id: org.telegram_chat_id,
            message_id: msgId,
          });
        } catch (e) {
          console.error("Error deleting old message:", msgId, e);
        }
      }

      // Send reminder message
      const result = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
        chat_id: org.telegram_chat_id,
        text: message,
        reply_markup: keyboard,
      });

      if (result.ok && result.result) {
        const newMessageId = result.result.message_id;

        // Update telegram_message_id and ids
        await supabase
          .from("requests")
          .update({
            telegram_message_id: newMessageId,
            telegram_message_ids: [newMessageId],
          })
          .eq("id", request.id);

        // Log activity to prevent duplicate reminders
        await supabase.from("request_activities").insert({
          request_id: request.id,
          organization_id: request.organization_id,
          action: "delivery_reminder_sent",
          description: "Повторное уведомление о подтверждении получения (24ч)",
        });

        sentCount++;
        console.log(`Reminder sent for request ${request.request_number}`);
      } else {
        console.error(`Failed to send reminder for ${request.request_number}:`, result);
      }
    }

    console.log(`Total reminders sent: ${sentCount}`);
    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in resend-delivery-reminder:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
