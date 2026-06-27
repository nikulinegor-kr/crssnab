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

  const prompt = `Ты — управленческий ассистент CRM «Снабжение». Сформируй краткое ежедневное резюме для руководителя на сегодня.

Данные (агрегаты по открытым заявкам на сегодня) в JSON:
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

Требования к ответу:
- Один экран текста, по делу, без воды.
- Markdown, разделы: «Главное за минуту», «Что сделать в первую очередь», «Узкие места», «Риски и решения», «Прогноз дня».
- Конкретные цифры из данных. Не выдумывай факты, не упоминай несуществующие заявки.
- Если показатель равен 0 — не пиши о нём.
- В конце — 1 короткая фраза-мотивация на день.
Отвечай только на русском.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Ты — деловой управленческий ассистент. Пиши кратко, по делу, в Markdown." },
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
