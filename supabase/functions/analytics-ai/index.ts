import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MODEL = "google/gemini-3-flash-preview";

type Row = Record<string, unknown>;

function ok(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}
function bad(status: number, message: string) {
  return ok({ error: message }, { status });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Method not allowed");
  if (!LOVABLE_API_KEY) return bad(500, "LOVABLE_API_KEY not configured");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad(401, "Missing authorization");

  let body: { organization_id?: string; period_from?: string; period_to?: string };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid JSON");
  }
  const { organization_id, period_from, period_to } = body ?? {};
  if (!organization_id || !period_from || !period_to) {
    return bad(400, "organization_id, period_from, period_to required");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return bad(401, "Unauthorized");
  const userId = userData.user.id;

  // Verify org membership
  const { data: membership } = await userClient
    .from("user_organizations")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organization_id)
    .maybeSingle();
  if (!membership) return bad(403, "Not a member of this organization");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Aggregate data
  const aggregates = await buildAggregates(admin, organization_id, period_from, period_to);

  const prompt = `Ты — управленческий аналитик CRM «Снабжение». Период анализа: ${period_from} … ${period_to}.

Ниже агрегированные данные по заявкам организации в формате JSON. Тебе нужно:
1) Сделать конкретные выводы — что хорошо, что плохо, почему.
2) Выделить риски и аномалии (необычный рост расходов, перегруженных сотрудников, проблемных поставщиков, объекты с превышениями, узкие места в процессе).
3) Дать руководителю практические рекомендации: что перераспределить, что оптимизировать, кого подтянуть, что проверить.
4) При наличии данных — спрогнозировать загрузку и расходы на следующий месяц.

Отвечай на русском, кратко и по делу, в Markdown. Используй разделы: «Ключевые выводы», «Сотрудники», «Заявки и сроки», «Финансы», «Поставщики и логистика», «Объекты», «Аномалии и риски», «Рекомендации», «Прогноз».
Не выдумывай факты — если данных мало, так и пиши.

ДАННЫЕ:
\`\`\`json
${JSON.stringify(aggregates, null, 2)}
\`\`\``;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Ты — управленческий бизнес-аналитик. Отвечай чётко, в Markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text();
    if (aiRes.status === 429) return bad(429, "AI rate limited: " + txt);
    if (aiRes.status === 402) return bad(402, "AI credits exhausted: " + txt);
    return bad(500, `AI gateway error ${aiRes.status}: ${txt}`);
  }
  const aiJson = await aiRes.json();
  const content: string = aiJson.choices?.[0]?.message?.content ?? "";
  if (!content) return bad(500, "Empty AI response");

  const summary = content.split("\n").find((l) => l.trim().length > 20)?.slice(0, 200) ?? null;

  const { data: insertResult, error: insertErr } = await admin
    .from("ai_analytics_reports")
    .insert({
      organization_id,
      created_by: userId,
      period_from,
      period_to,
      summary,
      content,
      model: MODEL,
    })
    .select()
    .single();

  if (insertErr) return bad(500, "Failed to save report: " + insertErr.message);

  return ok({ report: insertResult });
});

async function buildAggregates(admin: ReturnType<typeof createClient>, orgId: string, from: string, to: string) {
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(new Date(to).getTime() + 86400000 - 1).toISOString();

  // fetch all requests in window (paginated)
  const all: Row[] = [];
  let pos = 0;
  const PAGE = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin
      .from("requests")
      .select(
        "id,status,priority,executor,contractor,object_id,amount,amount_2,amount_3,invoice_date,payment_status,transport_company,shipment_date,delivery_date,actual_arrival_date,created_at",
      )
      .eq("organization_id", orgId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .range(pos, pos + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    pos += PAGE;
  }

  const sumAmount = (r: any) => (r.amount ?? 0) + (r.amount_2 ?? 0) + (r.amount_3 ?? 0);
  const days = (a?: string | null, b?: string | null) => {
    if (!a || !b) return null;
    return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
  };
  const avg = (xs: (number | null)[]) => {
    const ys = xs.filter((x): x is number => typeof x === "number");
    return ys.length ? +(ys.reduce((s, n) => s + n, 0) / ys.length).toFixed(2) : null;
  };

  const isDelivered = (r: any) => r.status === "Доставлено";
  const isOverdue = (r: any) =>
    !isDelivered(r) &&
    r.delivery_date &&
    new Date(r.delivery_date).getTime() < Date.now();

  const groupBy = <K extends string>(rows: any[], key: (r: any) => K | undefined) => {
    const m = new Map<K, any[]>();
    for (const r of rows) {
      const k = key(r);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  };

  const executorAgg = Array.from(groupBy(all, (r) => r.executor as string).entries()).map(([ex, rows]) => ({
    executor: ex,
    total: rows.length,
    delivered: rows.filter(isDelivered).length,
    overdue: rows.filter(isOverdue).length,
    amount: Math.round(rows.reduce((s, r) => s + sumAmount(r), 0)),
    avg_cycle_days: avg(rows.filter(isDelivered).map((r) => days(r.created_at, r.actual_arrival_date))),
    emergency: rows.filter((r) => (r.priority ?? "").toLowerCase().includes("авар")).length,
  }));

  const contractorAgg = Array.from(groupBy(all, (r) => r.contractor as string).entries())
    .map(([c, rows]) => ({
      contractor: c,
      total: rows.length,
      amount: Math.round(rows.reduce((s, r) => s + sumAmount(r), 0)),
      overdue: rows.filter(isOverdue).length,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  const tkAgg = Array.from(groupBy(all, (r) => r.transport_company as string).entries()).map(([tk, rows]) => {
    const del = rows.filter(isDelivered);
    return {
      tk,
      total: rows.length,
      delivered: del.length,
      avg_days: avg(del.map((r) => days(r.shipment_date, r.actual_arrival_date))),
    };
  });

  const monthAgg = Array.from(
    groupBy(all, (r) => (r.created_at as string).slice(0, 7) as string).entries(),
  )
    .map(([m, rows]) => ({
      month: m,
      total: rows.length,
      delivered: rows.filter(isDelivered).length,
      overdue: rows.filter(isOverdue).length,
      amount: Math.round(rows.reduce((s, r) => s + sumAmount(r), 0)),
    }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  return {
    period: { from, to },
    totals: {
      requests: all.length,
      delivered: all.filter(isDelivered).length,
      overdue: all.filter(isOverdue).length,
      amount: Math.round(all.reduce((s, r) => s + sumAmount(r), 0)),
    },
    by_executor: executorAgg.sort((a, b) => b.total - a.total).slice(0, 25),
    top_contractors: contractorAgg,
    transport_companies: tkAgg,
    by_month: monthAgg,
  };
}
