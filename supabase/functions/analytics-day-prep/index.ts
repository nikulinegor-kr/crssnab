import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MODEL = "google/gemini-3-flash-preview";

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

  let body: { organization_id?: string; snapshot?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid JSON");
  }
  const { organization_id, snapshot } = body ?? {};
  if (!organization_id || !snapshot) {
    return bad(400, "organization_id and snapshot required");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return bad(401, "Unauthorized");

  const { data: membership } = await userClient
    .from("user_organizations")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("organization_id", organization_id)
    .maybeSingle();
  if (!membership) return bad(403, "Not a member of this organization");

  const prompt = `Ты — управленческий ассистент CRM «Снабжение». Формируешь КОРОТКОЕ AI-РЕЗЮМЕ ДНЯ, которое руководитель читает за 15–20 секунд.

ДАННЫЕ (JSON):
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

ЦЕЛЬ РЕЗЮМЕ — ответить на 3 вопроса:
1. Что горит?
2. Что изменилось сегодня?
3. Куда нужно вмешаться руководителю?

ЖЁСТКИЕ ПРАВИЛА:
- Кратко. Без длинных объяснений и пересказа базы. Анализируй, а не перечисляй.
- В каждом списковом разделе — МАКСИМУМ 5 позиций, отсортированных по критичности (дни без движения / просрочка / сумма). Остальное НЕ выводи — фронт сам покажет «Показать ещё».
- Не повторяй в каждой строке объект, исполнителя, контрагента, статус и прочие поля. В строке заявки — только название (ссылка) и ОДНА ключевая метрика: «X дней без движения», «просрочка X дн.», «сумма X ₽» и т.п.
- Название заявки — кликабельная ссылка строго в формате \`[{description}](/requests/{id})\`. Если description пустое — «Без названия». Не показывай REQ-номера.
- Не выдумывай данные. Если раздел пуст — пропусти его целиком.
- Суммы — с разделителем тысяч и «₽».
- Только русский, Markdown. Никаких лишних заголовков сверх указанных.

СТРОГАЯ СТРУКТУРА (соблюдай заголовки и порядок дословно):

# AI-резюме дня

## Главное
4–5 коротких строк-фактов с цифрами из данных. Пример: «27 аварийных заявок требуют контроля.», «5 заявок просрочены.», «8 заявок без движения более 5 дней.», «Сегодня ожидается 3 поставки.». Без ссылок.

## 🔴 Требуют решения — {N}
До 5 самых критичных заявок (максимальное число дней без движения / наибольшая просрочка). Каждая строка:
- [{description}](/requests/{id}) — {краткая метрика, напр. «25 дней без движения»}

## 🟠 Риски
До 5 коротких строк-агрегатов о рисках: задерживающиеся поставки, заявки без исполнителя, счета в ожидании оплаты, зависшая бухгалтерия и т.п. Только цифры и суть, без списков заявок. Если рисков нет — пропусти раздел.

## 🟢 Сегодня
До 5 строк о движении за сегодня: ожидаемые поставки, завершённые заявки, новые аварийные, оплаченные счета. Только цифры. Если данных за сегодня нет — пропусти раздел.

## Фокус руководителя
Одна короткая фраза (1–2 предложения): куда именно вмешаться прямо сейчас, с числами. Без списка.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "Ты — деловой управленческий ассистент. Формируешь итемизированные управленческие отчёты. Каждый пункт — с деталями и кликабельной ссылкой на карточку заявки. Не пишешь общими фразами. Не выдумываешь данные.",
        },
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

  return ok({ content });
});
