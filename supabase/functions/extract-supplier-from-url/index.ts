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

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || !parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildCandidateUrls(raw: string): string[] {
  const normalized = normalizeUrl(raw);
  if (!normalized) return [];

  const base = new URL(normalized);
  const protocols = base.protocol === "https:" ? ["https:", "http:"] : [base.protocol];
  const hostVariants = base.hostname.startsWith("www.")
    ? [base.hostname, base.hostname.replace(/^www\./, "")]
    : [base.hostname, `www.${base.hostname}`];
  const suffix = `${base.pathname}${base.search}`;

  return Array.from(new Set(
    protocols.flatMap((protocol) => hostVariants.map((host) => `${protocol}//${host}${suffix}`)),
  ));
}

function extractRelevantLinks(html: string, baseUrl: string): string[] {
  const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const links = new Set<string>();
  const keywords = /(контакт|реквизит|о\s*компан|about|contact|company)/i;

  for (const match of matches) {
    const href = match[1]?.trim();
    const label = match[2]?.replace(/<[^>]+>/g, " ").trim() || "";
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    if (!keywords.test(`${href} ${label}`)) continue;

    try {
      links.add(new URL(href, baseUrl).toString());
      if (links.size >= 3) break;
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

async function fetchPageHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CRSSnabBot/1.0; +https://crssnab.ru)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return null;
  const html = await response.text();
  return html ? { html, finalUrl: response.url || url } : null;
}

async function fetchViaJina(rawUrl: string): Promise<string> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "";

  try {
    const response = await fetch(`https://r.jina.ai/http://${new URL(normalized).host}${new URL(normalized).pathname}${new URL(normalized).search}`, {
      headers: {
        "Accept": "text/plain, text/markdown;q=0.9, */*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; CRSSnabBot/1.0; +https://crssnab.ru)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const text = await response.text();
    return text.slice(0, 18000).trim();
  } catch (e) {
    console.warn("jina fallback failed", normalized, e);
    return "";
  }
}

async function fetchSiteText(rawUrl: string): Promise<{ pageText: string; normalizedUrl: string | null; fetched: boolean }> {
  const candidates = buildCandidateUrls(rawUrl);
  if (!candidates.length) {
    return { pageText: "", normalizedUrl: null, fetched: false };
  }

  for (const candidate of candidates.slice(0, 2)) {
    try {
      const homePage = await fetchPageHtml(candidate);
      if (!homePage) continue;

      const chunks = [stripHtml(homePage.html)];
      const contactLinks = extractRelevantLinks(homePage.html, homePage.finalUrl);

      for (const link of contactLinks.slice(0, 2)) {
        try {
          const contactPage = await fetchPageHtml(link);
          if (contactPage?.html) {
            chunks.push(stripHtml(contactPage.html));
          }
        } catch (e) {
          console.warn("contact page fetch failed", link, e);
        }
      }

      return {
        pageText: chunks.filter(Boolean).join("\n\n").slice(0, 18000),
        normalizedUrl: homePage.finalUrl || candidate,
        fetched: true,
      };
    } catch (e) {
      console.warn("fetch failed", candidate, e);
    }
  }

  const fallbackText = await fetchViaJina(candidates[0]);
  if (fallbackText) {
    return {
      pageText: fallbackText,
      normalizedUrl: candidates[0],
      fetched: true,
    };
  }

  return { pageText: "", normalizedUrl: candidates[0] ?? null, fetched: false };
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

    const { pageText, normalizedUrl, fetched } = await fetchSiteText(url);
    if (!normalizedUrl) {
      return new Response(JSON.stringify({ error: "Некорректный адрес сайта" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = pageText
      ? `Извлеки данные о компании-поставщике из текста сайта. URL: ${normalizedUrl}\n\nТЕКСТ САЙТА:\n${pageText}`
      : `Не удалось получить страницу. URL: ${normalizedUrl}. Верни пустые поля, кроме website_url.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
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
      website_url: normalizedUrl,
      fetched,
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
