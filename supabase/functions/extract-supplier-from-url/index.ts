import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function stripHtml(html: string): string {
  // Drop script/style blocks
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Convert breaks
  s = s.replace(/<\/(p|div|li|tr|br|h[1-6])>/gi, "\n");
  // Strip tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode common entities
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return s.slice(0, 18000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch page (best-effort)
    let pageText = "";
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CRSSnabBot/1.0; +https://crssnab.ru)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (r.ok) {
        const html = await r.text();
        pageText = stripHtml(html);
      }
    } catch (e) {
      console.warn("fetch failed", e);
    }

    const prompt = pageText
      ? `Извлеки данные о компании-поставщике из текста сайта. URL: ${url}\n\nТЕКСТ САЙТА:\n${pageText}`
      : `Не удалось получить страницу. URL: ${url}. Верни пустые поля, кроме website_url.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Ты извлекаешь контактные данные организации-поставщика с её сайта. Верни только результат через tool call. Если данных нет — пустые строки. Телефон в формате +7..., email в нижнем регистре.",
          },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "supplier_info",
            description: "Контактные данные поставщика",
            parameters: {
              type: "object",
              properties: {
                supplier_name: { type: "string", description: "Полное название организации с ОПФ (ООО, АО, ИП и т.п.)" },
                contact_person: { type: "string", description: "ФИО или должность контактного лица" },
                phone: { type: "string", description: "Основной телефон" },
                email: { type: "string", description: "Основной email" },
              },
              required: ["supplier_name", "contact_person", "phone", "email"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "supplier_info" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились кредиты Lovable AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try { parsed = JSON.parse(args || "{}"); } catch {}

    return new Response(JSON.stringify({
      supplier_name: parsed.supplier_name || "",
      contact_person: parsed.contact_person || "",
      phone: parsed.phone || "",
      email: parsed.email || "",
      website_url: url,
      fetched: !!pageText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extract-supplier-from-url error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
