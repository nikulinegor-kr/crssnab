import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type NotifType =
  | "shipment_tomorrow"
  | "arrival_3d"
  | "arrival_1d"
  | "arrival_today"
  | "overdue";

const FINAL_STATUSES = ["Доставлено", "Прибыло", "Закрыто", "Отменено", "Выполнено"];

function todayMsk(): Date {
  // server runs UTC; MSK = UTC+3
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3 * 3600 * 1000);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diffDays(a: Date, b: Date): number {
  const ms = new Date(ymd(a)).getTime() - new Date(ymd(b)).getTime();
  return Math.round(ms / 86400000);
}

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU");
}

function buildMessage(type: NotifType, r: any): string {
  const lines: string[] = [];
  const num = r.request_number ?? r.id;
  const desc = r.description || "—";
  const obj = r.object_name || r.object?.name || null;
  const contractor = r.contractor || null;
  const exec = r.executor || null;
  const tc = r.transport_company || null;

  const header = (() => {
    switch (type) {
      case "shipment_tomorrow": return `🚛 <b>Завтра отгрузка</b>`;
      case "arrival_3d":       return `📦 <b>До прибытия осталось 3 дня</b>`;
      case "arrival_1d":       return `⚠️ <b>Прибытие завтра</b>`;
      case "arrival_today":    return `✅ <b>Сегодня прибытие</b>`;
      case "overdue": {
        const today = todayMsk();
        const days = r.delivery_date ? diffDays(today, new Date(r.delivery_date)) : 0;
        return `❌ <b>Просрочка доставки</b> — ${days} дн.`;
      }
    }
  })();

  lines.push(header);
  lines.push("");
  lines.push(`🧾 Заявка #${num}`);
  if (desc) lines.push(`📝 ${desc}`);
  if (obj) lines.push(`🏗 Объект — ${obj}`);
  if (contractor) lines.push(`🏢 Контрагент — ${contractor}`);
  if (tc) lines.push(`🚛 ТК — ${tc}`);
  if (type === "shipment_tomorrow" && r.shipment_date) {
    lines.push(`📅 Дата отгрузки — ${fmt(r.shipment_date)}`);
  }
  if (type !== "shipment_tomorrow" && r.delivery_date) {
    lines.push(`📅 Плановое прибытие — ${fmt(r.delivery_date)}`);
  }
  if (exec) lines.push(`👤 Ответственный — ${exec}`);

  return lines.join("\n");
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return await res.json();
}

function decideTypes(r: any, today: Date, settings: any): NotifType[] {
  const types: NotifType[] = [];
  if (r.shipment_date && settings.notify_shipment_tomorrow) {
    if (diffDays(new Date(r.shipment_date), today) === 1) types.push("shipment_tomorrow");
  }
  if (r.delivery_date) {
    const d = diffDays(new Date(r.delivery_date), today);
    if (d === 3 && settings.notify_arrival_3d) types.push("arrival_3d");
    if (d === 1 && settings.notify_arrival_1d) types.push("arrival_1d");
    if (d === 0 && settings.notify_arrival_today) types.push("arrival_today");
    if (d < 0 && settings.notify_overdue && !FINAL_STATUSES.includes(r.status)) types.push("overdue");
  }
  return types;
}

async function processOrg(orgId: string, opts: { requestId?: string; force?: boolean; userId?: string }) {
  // settings (auto-create defaults if missing)
  let { data: settings } = await supabase
    .from("notification_schedule_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!settings) {
    const ins = await supabase
      .from("notification_schedule_settings")
      .insert({ organization_id: orgId })
      .select("*")
      .single();
    settings = ins.data;
  }
  if (!settings?.enabled && !opts.force) return { sent: 0, skipped: "disabled" };

  // telegram creds
  const { data: tg } = await supabase
    .from("telegram_settings")
    .select("bot_token, chat_id, deadline_chat_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  const targetChatId = tg?.deadline_chat_id || tg?.chat_id;
  if (!tg?.bot_token || !targetChatId) return { sent: 0, skipped: "no_telegram" };

  // requests
  let q = supabase
    .from("requests")
    .select("id, organization_id, request_number, description, status, contractor, executor, shipment_date, delivery_date, transport_company, archived, actual_arrival_date, object_id")
    .eq("organization_id", orgId)
    .eq("archived", false);
  if (opts.requestId) q = q.eq("id", opts.requestId);
  const { data: requests, error: reqErr } = await q;
  if (reqErr) throw reqErr;

  const today = todayMsk();
  let sent = 0;
  const results: any[] = [];

  for (const r of requests || []) {
    if (r.actual_arrival_date) continue; // already arrived
    if (FINAL_STATUSES.includes(r.status) && !opts.force) continue;

    let types: NotifType[];
    if (opts.force && opts.requestId) {
      // manual: figure out the most relevant type, or send the closest match
      types = decideTypes(r, today, {
        notify_shipment_tomorrow: true, notify_arrival_3d: true,
        notify_arrival_1d: true, notify_arrival_today: true, notify_overdue: true,
      });
      if (types.length === 0) {
        // fallback: send a generic delivery reminder using closest applicable type
        if (r.delivery_date) {
          const d = diffDays(new Date(r.delivery_date), today);
          types = [d < 0 ? "overdue" : d === 0 ? "arrival_today" : d === 1 ? "arrival_1d" : "arrival_3d"];
        } else if (r.shipment_date) {
          types = ["shipment_tomorrow"];
        }
      }
    } else {
      types = decideTypes(r, today, settings);
    }

    for (const type of types) {
      if (!opts.force) {
        const { data: existing } = await supabase
          .from("request_notification_log")
          .select("id")
          .eq("request_id", r.id)
          .eq("notification_type", type)
          .maybeSingle();
        if (existing) continue;
      }

      const text = buildMessage(type, r);
      const tgResp = await sendTelegram(tg.bot_token, targetChatId, text);
      const ok = tgResp?.ok === true;
      const messageId = tgResp?.result?.message_id ?? null;

      if (ok) {
        // upsert log (force may overwrite existing row)
        await supabase
          .from("request_notification_log")
          .upsert({
            request_id: r.id,
            organization_id: orgId,
            notification_type: type,
            sent_at: new Date().toISOString(),
            sent_by: opts.userId ?? null,
            telegram_message_id: messageId,
            forced: !!opts.force,
          }, { onConflict: "request_id,notification_type" });
        sent++;
        results.push({ request_id: r.id, type, ok: true });

        // Параллельно создаём in-app уведомления → realtime триггерит браузерный push
        try {
          const titleMap: Record<NotifType, string> = {
            shipment_tomorrow: "🚛 Завтра отгрузка",
            arrival_3d: "📦 Прибытие через 3 дня",
            arrival_1d: "⚠️ Прибытие завтра",
            arrival_today: "✅ Сегодня прибытие",
            overdue: "❌ Просрочка доставки",
          };
          const shortBody = `Заявка #${r.request_number}${r.description ? " — " + r.description : ""}`;
          const link = `/requests/${r.id}`;

          const { data: members } = await supabase
            .from("user_organizations")
            .select("user_id")
            .eq("organization_id", orgId)
            .in("role", ["owner", "admin", "editor"]);

          if (members && members.length > 0) {
            const rows = members.map((m: any) => ({
              user_id: m.user_id,
              organization_id: orgId,
              type: `shipment_${type}`,
              title: titleMap[type],
              message: shortBody,
              link,
            }));
            await supabase.from("notifications").insert(rows);
          }
        } catch (e) {
          console.error("in-app notification insert failed", e);
        }
      } else {
        results.push({ request_id: r.id, type, ok: false, error: tgResp?.description });
      }
    }
  }

  return { sent, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestId: string | undefined = body.requestId;
    const force: boolean = !!body.force;
    let orgId: string | undefined = body.organizationId;
    let userId: string | undefined;

    // identify user from JWT if available
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
      userId = u?.user?.id;
    }

    // if requestId provided but no org, derive from request
    if (requestId && !orgId) {
      const { data } = await supabase.from("requests").select("organization_id").eq("id", requestId).maybeSingle();
      orgId = data?.organization_id;
    }

    let totals = { sent: 0, orgs: 0, details: [] as any[] };

    if (orgId) {
      const r = await processOrg(orgId, { requestId, force, userId });
      totals = { sent: r.sent ?? 0, orgs: 1, details: [r] };
    } else {
      // cron mode: iterate all orgs that have telegram configured
      const { data: orgs } = await supabase
        .from("telegram_settings")
        .select("organization_id")
        .not("bot_token", "is", null)
        .not("chat_id", "is", null);
      for (const o of orgs ?? []) {
        const r = await processOrg(o.organization_id, { force: false });
        totals.sent += r.sent ?? 0;
        totals.orgs++;
        totals.details.push({ orgId: o.organization_id, ...r });
      }
    }

    return new Response(JSON.stringify({ success: true, ...totals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-shipment-notifications error", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
