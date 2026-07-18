// Analyze a part (filter element or spare part) using Lovable AI
// STRICT CATALOG MODE: AI is not allowed to guess compatibility.
// It must rely only on official OEM catalogs and verified cross-reference sources
// (Donaldson, Baldwin, Fleetguard, MANN, WIX, Sakura, HIFI, Hengst, Bosch, Fram).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  orgId: string;
  kind: "filter" | "spare";
  article?: string;
  cross_number?: string;
  name?: string;
  manufacturer?: string;
  excludeId?: string;
  image_base64?: string;
  image_mime?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body: Payload = await req.json();
    let { orgId, kind, article, cross_number, name, manufacturer, excludeId, image_base64, image_mime } = body;
    if (!orgId) throw new Error("orgId required");
    const key = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Normalize article: strip spaces, dashes, dots, slashes, underscores, upper-case
    const normalizeArticle = (s?: string) => (s ?? "").toUpperCase().replace(/[\s\-_./]/g, "").trim();
    const articleNorm = normalizeArticle(article);

    const table = kind === "filter" ? "filter_elements" : "spare_parts";
    const movTable = kind === "filter" ? "filter_element_movements" : "spare_part_movements";
    const compatTable = kind === "filter" ? "filter_element_equipment" : "spare_part_equipment";
    const fkCol = kind === "filter" ? "filter_element_id" : "spare_part_id";

    // 0. Photo vision — only extracts identifiers (article/manufacturer/name/cross), never compatibility
    let vision: any = null;
    if (key && image_base64) {
      try {
        const dataUrl = image_base64.startsWith("data:")
          ? image_base64
          : `data:${image_mime || "image/jpeg"};base64,${image_base64}`;
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `Ты эксперт по маркировке запчастей и фильтров. С фото извлеки ТОЛЬКО видимые идентификаторы. НЕ придумывай данные. Верни строго JSON: {"article": string|null, "manufacturer": string|null, "name": string|null, "cross_numbers": string[]}.` },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            }],
            response_format: { type: "json_object" },
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const text = j?.choices?.[0]?.message?.content ?? "{}";
          try { vision = JSON.parse(text); }
          catch { const m = text.match(/\{[\s\S]*\}/); if (m) vision = JSON.parse(m[0]); }
          if (vision) {
            article = article || vision.article || undefined;
            manufacturer = manufacturer || vision.manufacturer || undefined;
            name = name || vision.name || undefined;
            if (!cross_number && Array.isArray(vision.cross_numbers) && vision.cross_numbers[0]) {
              cross_number = vision.cross_numbers[0];
            }
          }
        }
      } catch (e) {
        console.error("vision failed", e);
      }
    }

    // 1. Duplicates in CRM
    const searchTerms = [article, cross_number, name].map((t) => (t ?? "").trim()).filter(Boolean);
    let duplicate: any = null;
    let candidates: any[] = [];
    if (searchTerms.length) {
      const { data: rows } = await supabase
        .from(table)
        .select("*")
        .eq("organization_id", orgId)
        .limit(500);
      const norm = (s: any) => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[-_./]/g, "");
      for (const r of rows ?? []) {
        if (excludeId && r.id === excludeId) continue;
        const artN = norm(r.article);
        const crossN = (r.cross_numbers ?? []).map(norm);
        const nameN = norm(r.name);
        const hits = searchTerms.some((t) => {
          const tn = norm(t);
          if (!tn) return false;
          if (artN && (artN === tn || artN.includes(tn) || tn.includes(artN))) return true;
          if (crossN.some((c: string) => c === tn || c.includes(tn) || tn.includes(c))) return true;
          if (nameN && tn.length >= 4 && (nameN.includes(tn) || tn.includes(nameN))) return true;
          return false;
        });
        if (hits) candidates.push(r);
      }
      duplicate = candidates[0] ?? null;
    }

    let duplicateInfo: any = null;
    if (duplicate) {
      const [{ data: movs }, { data: comp }] = await Promise.all([
        supabase.from(movTable).select("type, quantity").eq(fkCol, duplicate.id),
        supabase
          .from(compatTable)
          .select("equipment:equipment_id(id, brand, model, plate_number, year)")
          .eq(fkCol, duplicate.id),
      ]);
      let stock = 0;
      (movs ?? []).forEach((m: any) => {
        const q = Number(m.quantity) || 0;
        if (m.type === "IN" || m.type === "RETURN" || m.type === "ADJUST") stock += q;
        else if (m.type === "WRITE_OFF" || m.type === "SALE") stock -= q;
      });
      duplicateInfo = {
        id: duplicate.id,
        name: duplicate.name,
        article: duplicate.article,
        manufacturer: duplicate.manufacturer,
        storage_location: duplicate.storage_location,
        cross_numbers: duplicate.cross_numbers ?? [],
        stock,
        equipment: (comp ?? []).map((c: any) => c.equipment).filter(Boolean),
      };
    }

    // Purchase history
    const partIdsForHistory = candidates.map((c) => c.id);
    let priceInfo: any = null;
    if (partIdsForHistory.length) {
      const { data: ins } = await supabase
        .from(movTable)
        .select("unit_price, supplier, quantity, created_at, request_id")
        .in(fkCol, partIdsForHistory)
        .eq("type", "IN")
        .order("created_at", { ascending: false });
      const priced = (ins ?? []).filter((m: any) => m.unit_price && Number(m.unit_price) > 0);
      if (priced.length) {
        const totalQty = priced.reduce((s: number, m: any) => s + Number(m.quantity || 0), 0);
        const totalSum = priced.reduce((s: number, m: any) => s + Number(m.unit_price) * Number(m.quantity || 0), 0);
        const suppliers = Array.from(new Set(priced.map((m: any) => m.supplier).filter(Boolean))).slice(0, 5);
        priceInfo = {
          last_price: Number(priced[0].unit_price),
          last_at: priced[0].created_at,
          last_supplier: priced[0].supplier ?? null,
          avg_price: totalQty ? totalSum / totalQty : null,
          suppliers,
          purchase_count: priced.length,
        };
      }
    }

    // CRM equipment
    const { data: equipment } = await supabase
      .from("equipment")
      .select("id, brand, model, plate_number, year")
      .eq("organization_id", orgId)
      .limit(500);

    // Catalog lookup via AI (strict mode)
    let ai: any = null;
    let notFound = false;
    if (key && (article?.trim() || cross_number?.trim())) {
      const eqLabels = (equipment ?? []).map((e: any) => ({
        id: e.id,
        brand: e.brand ?? "",
        model: e.model ?? "",
        plate: e.plate_number ?? "",
        year: e.year ?? null,
      }));

      const prompt = `Ты — строгий поисковик по официальным каталогам запчастей и фильтров. Работаешь как ChatGPT-API для CRM закупок и ремонта техники.

⛔ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
• Придумывать совместимость и данные.
• Делать выводы вида «если производитель CAT — значит подходит ко всему CAT».
• Расширять модель: если каталог содержит "CAT 420F" — НЕЛЬЗЯ добавлять "CAT 420". Если "CAT 320GC" — НЕЛЬЗЯ "CAT 320". Если "CAT 320D2" — НЕЛЬЗЯ "CAT 320D". Модель должна совпадать ПОЛНОСТЬЮ (со всеми суффиксами: F, GC, D2, K, L, M, N, H, B, C и т.д.).
• Использовать эвристики по названию.

Точность важнее количества. Лучше ноль моделей, чем одна неправильная.

✅ РАЗРЕШЕНО ТОЛЬКО:
Данные из официальных каталогов и проверенных кросс-референсов:
1) OEM (Caterpillar Parts, Komatsu, Volvo, Hitachi, JCB, Case, John Deere, Hyundai, Doosan, Liebherr, Cummins, Perkins, Shantui, XCMG, SDLG, LiuGong)
2) Donaldson  3) Fleetguard  4) Baldwin  5) MANN Filter  6) WIX  7) Sakura  8) HIFI Filter  9) Hengst  10) Bosch  11) Fram  12) TecDoc

Если артикул НЕ найден ни в одном из этих источников — верни article_found=false и НЕ заполняй остальные поля.

────────────────────
ЭТАПЫ ОБРАБОТКИ:
1) Нормализуй артикул: "3621163", "362-1163", "362 1163" — это ОДИН и тот же артикул. Верни его каноническую форму (с дефисом по стандарту OEM, например "362-1163").
2) Определи производителя по артикулу.
3) Проверь существование артикула в каталогах.
4) Найди официальное английское название детали.
5) Выполни качественный технический перевод названия на русский язык (используй профессиональные термины: "Гидравлический фильтр", "Трансмиссионный фильтр", "Гидравлический / трансмиссионный фильтр", "Масляный фильтр двигателя", "Топливный фильтр", "Фильтр воздуха кабины", "Основной воздушный фильтр", "Внутренний воздушный фильтр" и т.п.).
6) Найди кросс-номера (Donaldson/Baldwin/Fleetguard/MANN/WIX...).
7) Найди совместимость СТРОГО по официальным каталогам, с точным совпадением моделей.
8) Сопоставь с парком компании — только точное совпадение brand + model (с суффиксами).

────────────────────
ВХОДНЫЕ ДАННЫЕ
• Артикул (сырой): ${article || "—"}
• Артикул (нормализованный): ${articleNorm || "—"}
• Производитель (подсказка): ${manufacturer || "—"}
• Кросс-номер: ${cross_number || "—"}
• Наименование (подсказка): ${name || "—"}
• Тип позиции: ${kind === "filter" ? "фильтрующий элемент" : "запасная часть"}

ПАРК ТЕХНИКИ КОМПАНИИ (выбирай ТОЛЬКО из этих id, точное совпадение brand+model включая суффиксы):
${eqLabels.map((e) => `${e.id} — ${e.brand} ${e.model}${e.plate ? ` (${e.plate})` : ""}${e.year ? ` [${e.year}]` : ""}`).join("\n") || "— парк пуст"}

Верни СТРОГО JSON без пояснений:
{
  "article_found": true|false,
  "article_normalized": string|null,
  "sources": [{"name": "Caterpillar Parts", "trust": "green|yellow|orange|red"}],
  "official_info": {
    "part_type_ru": string|null,
    "name_en": string|null,
    "name_ru": string|null,
    "manufacturer_en": string|null,
    "manufacturer_ru": string|null,
    "description_ru": string|null,
    "oems": [string],
    "cross_numbers": [string]
  } | null,
  "catalog_compatibility": [
    {"brand": string, "model": string, "years": string|null, "engine": string|null, "source": string|null}
  ],
  "company_compatible_equipment": [
    {"id": string, "confirmation_type": "OEM"|"Cross Reference", "sources": [string]}
  ],
  "trust_level": "green|yellow|orange|red",
  "trust_reason": string,
  "note": string|null
}

Правила:
• manufacturer_ru — формат "Caterpillar (Катерпиллар)", "Donaldson (Дональдсон)", "Fleetguard (Флитгард)", "Baldwin (Болдуин)".
• name_ru — грамотный технический перевод.
• confirmation_type: "OEM" если модель указана в каталоге OEM производителя техники (Caterpillar Parts и т.п.), иначе "Cross Reference".
• sources — массив конкретных названий источников, подтверждающих ЭТУ модель (например ["Caterpillar Parts", "Donaldson Cross Reference"]).
• trust_level: green — OEM или Donaldson; yellow — Baldwin/Fleetguard/MANN/WIX; orange — несколько сторонних; red — не подтверждено (тогда company_compatible_equipment пуст).

Если article_found=false — все поля кроме article_found и note должны быть null/пусты.`;

      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const text = j?.choices?.[0]?.message?.content ?? "{}";
          try { ai = JSON.parse(text); }
          catch { const m = text.match(/\{[\s\S]*\}/); if (m) ai = JSON.parse(m[0]); }

          if (ai) {
            notFound = ai.article_found === false;
            const valid = new Set((equipment ?? []).map((e: any) => e.id));
            const rawEntries: any[] = Array.isArray(ai.company_compatible_equipment)
              ? ai.company_compatible_equipment
              : Array.isArray(ai.company_compatible_equipment_ids)
                ? ai.company_compatible_equipment_ids.map((id: string) => ({ id, sources: [], confirmation_type: null }))
                : [];
            ai.company_compatible_equipment = rawEntries
              .filter((e: any) => e && typeof e.id === "string" && valid.has(e.id))
              .map((e: any) => {
                const sources: string[] = Array.isArray(e.sources)
                  ? e.sources.filter(Boolean)
                  : e.source ? [e.source] : [];
                return {
                  id: e.id,
                  confirmation_type: e.confirmation_type ?? null,
                  sources,
                };
              });

            if (ai.trust_level === "red") {
              ai.company_compatible_equipment = [];
            }
          }
        } else {
          console.error("AI error", r.status, await r.text());
        }
      } catch (e) {
        console.error("AI call failed", e);
      }
    }

    let company_equipment: any[] = [];
    if (ai?.company_compatible_equipment?.length) {
      const eqMap = new Map((equipment ?? []).map((e: any) => [e.id, e]));
      company_equipment = ai.company_compatible_equipment
        .map((entry: any) => {
          const eq = eqMap.get(entry.id);
          if (!eq) return null;
          const sources: string[] = entry.sources ?? [];
          return {
            ...eq,
            source: sources[0] ?? null,
            sources,
            sources_count: sources.length,
            confirmation_type: entry.confirmation_type ?? null,
          };
        })
        .filter(Boolean);
    }


    return new Response(
      JSON.stringify({
        duplicate: duplicateInfo,
        price: priceInfo,
        vision: vision
          ? {
              article: vision.article ?? null,
              manufacturer: vision.manufacturer ?? null,
              name: vision.name ?? null,
              cross_numbers: Array.isArray(vision.cross_numbers) ? vision.cross_numbers : [],
            }
          : null,
        ai: ai
          ? {
              article_found: ai.article_found !== false,
              not_found: notFound,
              article_normalized: ai.article_normalized ?? articleNorm ?? null,
              sources: Array.isArray(ai.sources) ? ai.sources : [],
              official_info: ai.official_info ?? null,
              catalog_compatibility: Array.isArray(ai.catalog_compatibility) ? ai.catalog_compatibility : [],
              company_equipment,
              trust_level: ai.trust_level ?? null,
              trust_reason: ai.trust_reason ?? null,
              note: ai.note ?? null,
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
