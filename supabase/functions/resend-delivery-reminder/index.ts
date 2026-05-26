import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Fetch telegram credentials from the dedicated telegram_settings table */
async function getTelegramSettingsForOrg(orgId: string) {
  const { data } = await supabase
    .from("telegram_settings")
    .select("bot_token, chat_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return { telegram_bot_token: data.bot_token, telegram_chat_id: data.chat_id };
}

// Yakutsk timezone offset: UTC+9
const YAKUTSK_OFFSET_HOURS = 9;

async function sendTelegramRequest(botToken: string, method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await response.json();
}

const MAX_API = "https://platform-api.max.ru";
async function maxSend(chatId: string, text: string, attachments?: any) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return { ok: false, error: "MAX_BOT_TOKEN not configured" } as any;
  const body: any = { text };
  if (attachments) body.attachments = attachments;
  const res = await fetch(`${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body: txt, parsed };
}
async function maxDelete(messageId: string | number) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return;
  try {
    await fetch(`${MAX_API}/messages?message_id=${encodeURIComponent(String(messageId))}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
  } catch (_) { /* ignore */ }
}
function maxStageKeyboard(reqId: string, stage: "receive" | "acceptance") {
  if (stage === "receive") {
    return [{
      type: "inline_keyboard",
      payload: { buttons: [[{ type: "callback", text: "📦 Получение подтверждено", payload: `delivrcv:${reqId}` }]] },
    }];
  }
  return [{
    type: "inline_keyboard",
    payload: {
      buttons: [
        [
          { type: "callback", text: "🟢 Принято без замечаний", payload: `delivok:${reqId}` },
          { type: "callback", text: "🔴 Обнаружено несоответствие", payload: `delivdisc:${reqId}` },
        ],
      ],
    },
  }];
}

function getPriorityEmoji(priority: string): string {
  const p = priority?.toLowerCase() || "";
  if (p.includes("авар")) return "🚨";
  if (p.includes("срочн")) return "⚡";
  return "⭐";
}

function formatReminderMessage(request: any, participants: any[] = [], stage: "receive" | "acceptance"): string {
  const lines: string[] = [];

  const getApplicantTelegram = (name: string): string | null => {
    if (!name) return null;
    const participant = participants.find(
      (p: any) => p.name === name && p.participant_type === "applicant"
    );
    return participant?.telegram_username ? `@${participant.telegram_username}` : null;
  };

  if (stage === "receive") {
    lines.push(`🔔 Напоминание: подтвердите получение!`);
  } else {
    lines.push(`🔔 Напоминание: подтвердите приёмку!`);
  }
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

/**
 * Get current hour in Yakutsk timezone (UTC+9)
 */
function getYakutskHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return (utcHour + YAKUTSK_OFFSET_HOURS) % 24;
}

/**
 * Check if current Yakutsk time is within a reminder window (10:00 or 13:00).
 * We allow a ±30 min window to account for cron scheduling.
 */
function isReminderWindow(): boolean {
  const now = new Date();
  const yakutskMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + YAKUTSK_OFFSET_HOURS * 60) % (24 * 60);
  // 10:00 = 600 min, 13:00 = 780 min. Allow window of [target-30, target+30]
  const windows = [600, 780];
  return windows.some(w => Math.abs(yakutskMinutes - w) <= 30);
}

/**
 * Get a key for the current reminder slot to prevent duplicates within the same window.
 * Returns "10" or "13" based on which window we're in.
 */
function getReminderSlot(): string {
  const now = new Date();
  const yakutskMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + YAKUTSK_OFFSET_HOURS * 60) % (24 * 60);
  if (Math.abs(yakutskMinutes - 600) <= 30) return "10";
  if (Math.abs(yakutskMinutes - 780) <= 30) return "13";
  return "other";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const yakutskHour = getYakutskHour();
    console.log(`Current Yakutsk hour: ${yakutskHour}:00`);

    // Only send reminders during the 10:00 and 13:00 windows (Yakutsk time)
    if (!isReminderWindow()) {
      console.log("Not in a reminder window (10:00 or 13:00 Yakutsk time). Skipping.");
      return new Response(JSON.stringify({ sent: 0, reason: "outside_reminder_window" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reminderSlot = getReminderSlot();
    console.log(`Reminder slot: ${reminderSlot}:00 Yakutsk time`);

    // Find requests still in "Доставлено в ТК" status
    const { data: requests, error: reqError } = await supabase
      .from("requests")
      .select(`
        id, description, status, priority, applicant, executor,
        transport_company, delivery_date, organization_id, request_number,
        telegram_message_id, telegram_message_ids
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

    // Today's date string in Yakutsk timezone for dedup key
    const nowUtc = new Date();
    const yakutskDate = new Date(nowUtc.getTime() + YAKUTSK_OFFSET_HOURS * 60 * 60 * 1000);
    const todayKey = yakutskDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const dedupDescription = `reminder_${todayKey}_${reminderSlot}`;

    let sentCount = 0;

    for (const request of requests) {
      const org = await getTelegramSettingsForOrg(request.organization_id);

      // Check if already fully accepted (accepted_no_issues = final "Доставлено" status)
      const { data: acceptedActivity } = await supabase
        .from("request_activities")
        .select("id")
        .eq("request_id", request.id)
        .eq("action", "accepted_no_issues")
        .limit(1);

      if (acceptedActivity && acceptedActivity.length > 0) {
        continue;
      }

      // Check if received_confirmed exists
      const { data: confirmedActivity } = await supabase
        .from("request_activities")
        .select("id")
        .eq("request_id", request.id)
        .eq("action", "received_confirmed")
        .limit(1);

      const hasReceivedConfirmed = confirmedActivity && confirmedActivity.length > 0;
      const stage: "receive" | "acceptance" = hasReceivedConfirmed ? "acceptance" : "receive";
      const dedupKey = `${dedupDescription}_${stage}`;

      // Get participants for mentions (shared by TG and MAX)
      const { data: participants } = await supabase
        .from("request_participants")
        .select("name, telegram_username, participant_type")
        .eq("organization_id", request.organization_id)
        .eq("is_active", true);

      const message = formatReminderMessage(request, participants || [], stage);

      // ===== Telegram =====
      if (org?.telegram_bot_token && org?.telegram_chat_id) {
        const { data: existingReminder } = await supabase
          .from("request_activities")
          .select("id")
          .eq("request_id", request.id)
          .eq("action", "delivery_reminder_sent")
          .eq("description", dedupKey)
          .limit(1);

        if (!existingReminder || existingReminder.length === 0) {
          const tgKeyboard = stage === "receive"
            ? { inline_keyboard: [[{ text: "📦 Получение подтверждено", callback_data: "received" }]] }
            : { inline_keyboard: [
                [{ text: "🟢 Принято без замечаний", callback_data: "accepted_ok" }],
                [{ text: "🔴 Обнаружено несоответствие", callback_data: "discrepancy" }],
              ] };

          const existingMessageIds = request.telegram_message_ids || [];
          for (const msgId of existingMessageIds) {
            try {
              await sendTelegramRequest(org.telegram_bot_token, "deleteMessage", {
                chat_id: org.telegram_chat_id, message_id: msgId,
              });
            } catch (e) {
              console.error("Error deleting old TG message:", msgId, e);
            }
          }

          const result = await sendTelegramRequest(org.telegram_bot_token, "sendMessage", {
            chat_id: org.telegram_chat_id, text: message, reply_markup: tgKeyboard,
          });

          if (result.ok && result.result) {
            const newMessageId = result.result.message_id;
            await supabase
              .from("requests")
              .update({ telegram_message_id: newMessageId, telegram_message_ids: [newMessageId] })
              .eq("id", request.id);
            await supabase.from("request_activities").insert({
              request_id: request.id,
              organization_id: request.organization_id,
              action: "delivery_reminder_sent",
              description: dedupKey,
            });
            sentCount++;
            console.log(`TG reminder (${stage}) sent for ${request.request_number}`);
          } else {
            console.error(`Failed TG reminder for ${request.request_number}:`, result);
          }
        }
      }

      // ===== MAX =====
      const { data: maxGroups } = await supabase
        .from("max_groups")
        .select("group_id, last_max_message_id")
        .eq("organization_id", request.organization_id)
        .eq("notification_type", "supply")
        .eq("is_active", true);

      if (maxGroups && maxGroups.length > 0) {
        const maxDedupKey = `${dedupKey}_max`;
        const { data: existingMaxReminder } = await supabase
          .from("request_activities")
          .select("id")
          .eq("request_id", request.id)
          .eq("action", "delivery_reminder_sent")
          .eq("description", maxDedupKey)
          .limit(1);

        if (!existingMaxReminder || existingMaxReminder.length === 0) {
          const kb = maxStageKeyboard(request.id, stage);
          for (const g of maxGroups) {
            try {
              if (g.last_max_message_id) {
                await maxDelete(g.last_max_message_id);
              }
            } catch (_) { /* ignore */ }

            const res = await maxSend(String(g.group_id), message, kb);
            if (res.ok) {
              const newMid = res.parsed?.message?.body?.mid ?? res.parsed?.message?.mid ?? null;
              if (newMid) {
                await supabase
                  .from("max_groups")
                  .update({ last_max_message_id: String(newMid) })
                  .eq("group_id", String(g.group_id));
              }
              sentCount++;
              console.log(`MAX reminder (${stage}) sent for ${request.request_number} → ${g.group_id}`);
            } else {
              console.error(`Failed MAX reminder for ${request.request_number}:`, res);
            }
          }
          await supabase.from("request_activities").insert({
            request_id: request.id,
            organization_id: request.organization_id,
            action: "delivery_reminder_sent",
            description: maxDedupKey,
          });
        }
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
