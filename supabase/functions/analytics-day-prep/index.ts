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

  const prompt = `Ты — управленческий ассистент CRM «Снабжение». Формируешь ЕЖЕДНЕВНЫЙ ОТЧЁТ РУКОВОДИТЕЛЯ.

ДАННЫЕ (детальные списки заявок, счетов и сотрудников) в JSON:
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

ЖЁСТКИЕ ПРАВИЛА:
1. НИКОГДА не пиши общими фразами вида «Есть 5 просроченных заявок». После КАЖДОГО тезиса сразу выводи КОНКРЕТНЫЙ СПИСОК из данных с полями и ссылкой.
2. Каждая заявка/счёт/объект — отдельным пунктом маркированного списка. Формат пункта:
   - **[{description}](/requests/{id})**
     Объект: {object} • Исполнитель: {executor} • Контрагент: {contractor}
     Статус: {status} • {дополнительные поля: просрочка, дни без движения, сумма, счёт, дата и т.п.}
     _Причина/Что делать: {краткая причина или следующее действие}_
3. Ссылка на заявку ОБЯЗАТЕЛЬНА в каждом пункте. Используй строго путь \`/requests/{id}\` с id из данных. НЕ придумывай id, номера, названия — только то, что есть в JSON.
4. В ТЕКСТЕ ССЫЛОК И ПУНКТОВ используй ТОЛЬКО поле \`description\`. НИКОГДА не показывай номер заявки (REQ-…) или поле number/request_number. Если description пустое — напиши «Без названия».
5. Если данных по разделу нет — коротко напиши «Нет» и пропусти раздел, не выдумывай.
6. Все суммы форматируй с разделителем тысяч и «₽».
7. Пиши только на русском, Markdown.

СТРУКТУРА ОТЧЁТА (соблюдай порядок и заголовки):

# Ежедневный отчёт руководителя — {today}

## 1. Главное за минуту
3–5 строк: что критично сегодня, с цифрами. Каждая строка ссылается на раздел ниже.

## 2. Аварийные заявки в работе
Полный список \`emergency\`. Для каждой: объект, исполнитель, статус, дней без движения, ссылка.

## 3. Просроченные заявки
Полный список \`overdue\` (по убыванию дней просрочки). Для каждой: объект, исполнитель, дней просрочки, вероятная причина (используй поле reason из данных), ссылка.

## 4. Счета, ожидающие оплаты
Полный список \`invoices_pending_pay\`. Для каждого: № счёта, контрагент, сумма, дата выставления, сколько дней ожидает, ответственный, ссылка на заявку. В конце раздела — **Итого к оплате: {сумма}**.

## 5. Бухгалтерия
Список \`accounting_stuck\`. Для каждого: № счёта, контрагент, сумма, дней ожидания в бухгалтерии, ссылка. В конце:
- **Итого зависло:** {invoices_stuck_total_amount}
- **Среднее время выполнения заявки:** {avg_closure_days} дн.
- **Среднее ожидание в бухгалтерии:** {avg_accounting_wait_days} дн.
- **Без задержек в бухгалтерии среднее время выполнения было бы:** {avg_closure_days − avg_accounting_wait_days} дн.

## 6. Заявки без движения
Список \`stalled\` (> порогового числа дней в одном статусе). Для каждой: статус, дней без изменений, кто отвечает за следующий этап, ссылка.

## 7. Контроль сроков на сегодня
Три подпункта: оплатить сегодня (\`pay_today\`), отгрузить сегодня (\`ship_today\`), прибудет сегодня (\`arrive_today\`). Каждый — со списком и ссылками.

## 8. Сводка по сотрудникам
Для КАЖДОГО сотрудника из массива \`employees\` — отдельный подраздел \`### {name}\` со следующими блоками (если пусто — не выводи):
- **В работе:** {in_work} заявок
- **Аварийные:** список ссылок
- **Просроченные:** список ссылок с днями просрочки
- **Ожидают решения:** список ссылок
- **Счета на согласовании / к оплате:** список с суммами и ссылками
- **Самые проблемные:** топ-3 (наибольший возраст без движения) со ссылками
- **Ближайшие сроки:** сегодня/ближайшие 3 дня со ссылками

## 9. Что сделать сегодня
Нумерованный список из 5–8 конкретных действий с указанием суммы/количества и ссылками на конкретные заявки/счета из отчёта.

В самом конце — одна короткая мотивирующая фраза курсивом.`;

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
