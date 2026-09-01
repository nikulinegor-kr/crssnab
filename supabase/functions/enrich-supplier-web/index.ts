import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DADATA_API_KEY = Deno.env.get("DADATA_API_KEY");

function cityFromAddress(addr: any): string {
  if (!addr) return "";
  const d = addr.data || {};
  return d.city_with_type || d.city || d.settlement_with_type || d.settlement || d.region_with_type || "";
}

async function dadataParty(query: string) {
  if (!DADATA_API_KEY || !query) return null;
  try {
    const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify({ query: query.trim(), count: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.suggestions?.[0] || null;
  } catch (e) {
    console.warn("dadata failed", e);
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "User-Agent": "Mozilla/5.0 (compatible; CRSSnabBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 12000);
  } catch (e) {
    console.warn("fetch failed", url, e);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, inn, website } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Официальные данные из реестра (ЕГРЮЛ через DaData)
    const party = await dadataParty(inn || name);
    const registryCity = cityFromAddress(party?.data?.address);
    const okved = [party?.data?.okved, party?.data?.okveds?.map((o: any) => o.name).join("; ")]
      .filter(Boolean)
      .join(" ");

    // 2) Открытые источники в интернете
    const query = encodeURIComponent(`${name} ${inn || ""} официальный сайт чем занимается город`.trim());
    const sources: string[] = [];
    const webSearch = await fetchText(`https://www.bing.com/search?q=${query}`);
    if (webSearch) sources.push(`ПОИСК В ИНТЕРНЕТЕ:\n${webSearch}`);
    if (website) {
      const site = await fetchText(String(website).replace(/^https?:\/\//, "https://"));
      if (site) sources.push(`САЙТ КОМПАНИИ (${website}):\n${site}`);
    }

    const context = [
      `Название: ${name}`,
      inn ? `ИНН: ${inn}` : "",
      party?.data?.address?.unrestricted_value ? `Адрес из ЕГРЮЛ: ${party.data.address.unrestricted_value}` : "",
      okved ? `ОКВЭД: ${okved}` : "",
      ...sources,
    ].filter(Boolean).join("\n\n").slice(0, 24000);

    let city = registryCity;
    let nomenclature = "";
    let confidence: "high" | "medium" | "low" = registryCity ? "medium" : "low";

    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `Ты аналитик снабжения. По данным о российской компании определи:
1) city — город фактического расположения (только название города, без "г." и области).
2) nomenclature — что компания продаёт/производит: 2-6 коротких категорий товаров/услуг через запятую, до 120 символов, на русском.
3) confidence — high, если данные подтверждены сайтом или ЕГРЮЛ; medium — если выводится из ОКВЭД; low — если догадка.
Не выдумывай: если данных нет, верни пустую строку.
Ответ строго JSON: {"city":"","nomenclature":"","confidence":"low"} без markdown.`,
            },
            { role: "user", content: context },
          ],
        }),
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const content = data.choices?.[0]?.message?.content || "";
        try {
          const m = content.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            if (parsed.city) city = String(parsed.city).trim();
            if (parsed.nomenclature) nomenclature = String(parsed.nomenclature).trim().slice(0, 200);
            if (parsed.confidence) confidence = parsed.confidence;
          }
        } catch (e) {
          console.warn("parse ai json failed", e);
        }
      } else {
        const errText = await aiRes.text();
        console.error(`AI gateway error [${aiRes.status}]: ${errText}`);
        if (aiRes.status === 429 || aiRes.status === 402) {
          return new Response(JSON.stringify({ error: "AI лимит исчерпан", status: aiRes.status }), {
            status: aiRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        city: city || "",
        nomenclature,
        confidence,
        inn: party?.data?.inn || inn || "",
        address: party?.data?.address?.unrestricted_value || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("enrich-supplier-web error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
