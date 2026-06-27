// Planner daily brief — short AI plan of the day
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

  let body: { snapshot?: unknown; organization_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!body.snapshot)
    return new Response(JSON.stringify({ error: "snapshot required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const prompt = `Ты — ассистент Planner CRM «Снабжение». На основании снимка дня сформируй для сотрудника короткий план работы на сегодня.

Снимок дня (JSON):
\`\`\`json
${JSON.stringify(body.snapshot, null, 2)}
\`\`\`

Требования:
- 5–10 строк, без воды.
- Маркированный список, каждый пункт — конкретное действие с цифрами из данных.
- Сначала срочное (аварии, просрочки), потом счета, потом нагрузка по сотрудникам.
- Если показатель 0 — не упоминай.
- В конце 1 короткая фраза-рекомендация.
- Только русский язык, Markdown.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Ты — деловой ассистент. Пиши кратко, по делу, в Markdown." },
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
