// Analytics day prep — short narrative AI summary
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!LOVABLE_API_KEY)
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth)
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: { snapshot?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!body.snapshot)
    return new Response(JSON.stringify({ error: "snapshot required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const prompt = `Ты — управленческий помощник CRM «Снабжение». Тебе даны агрегированные показатели дня.

Напиши короткое связное описание ситуации на русском языке (не список, не таблицу, не заголовки, не bullet-ы). 2 абзаца обычным текстом + короткий финальный абзац «Фокус руководителя:».

Требования к тексту:
- Читается за 10–15 секунд, максимум ~120 слов на весь ответ.
- Первый абзац: главная проблема дня и цифры по бухгалтерии, просрочкам, аварийным, застрявшим, без поставщика.
- Второй абзац: что происходит сегодня (поступления, движения, новые аварийные).
- Финальный абзац начинается со слов «**Фокус руководителя:**» и содержит 1–2 конкретных приоритета.
- Самые важные числа и суммы выделяй **жирным** (Markdown).
- Не упоминай метрику, если её значение 0.
- Не выдумывай факты, используй только данные из snapshot.
- Никаких заголовков, списков, таблиц, эмодзи, ссылок.

ДАННЫЕ:
\`\`\`json
${JSON.stringify(body.snapshot, null, 2)}
\`\`\``;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Ты — деловой ассистент. Пиши коротко, связным человеческим текстом, без списков и таблиц." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text();
    const code = aiRes.status === 402 ? 402 : aiRes.status === 429 ? 429 : 500;
    return new Response(JSON.stringify({ error: `AI ${aiRes.status}: ${txt}` }), { status: code, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const aiJson = await aiRes.json();
  const content: string = aiJson.choices?.[0]?.message?.content ?? "";
  return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
