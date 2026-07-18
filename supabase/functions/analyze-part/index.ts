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

      const prompt = `Ты — ИСКЛЮЧИТЕЛЬНО инструмент извлечения данных из официальных каталогов запчастей. Ты НЕ определяешь совместимость. Ты только ЦИТИРУЕШЬ то, что записано в официальном OEM-каталоге производителя данного артикула.

🔒 ФУНДАМЕНТАЛЬНЫЙ ПРИНЦИП
Твоя роль — поиск, нормализация, структурирование и перевод.
Совместимость извлекается ТОЛЬКО из официального каталога OEM-производителя данного OEM-артикула.
Если модель техники не указана в этом каталоге против этого артикула — она НЕ существует для этого артикула. Точка.

🎯 ПРИОРИТЕТ
Лучше вернуть ноль моделей, чем одну неверную. Пустой ответ — это нормальный, ожидаемый и правильный ответ, если официального подтверждения нет.

⛔ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО
• Угадывать модели техники.
• Делать выводы по названию/типу/описанию фильтра или запчасти.
• Использовать кросс-номера (Donaldson/Baldwin/Fleetguard/MANN/WIX/Sakura/HIFI/Hengst/Bosch/Fram/TecDoc) для формирования списка совместимой техники — они служат ТОЛЬКО для отображения аналогов.
• Использовать похожие модели или семейства ("если есть 420F — значит подходит 420", "если есть 320GC — значит подходит 320" и т.п.). Модель должна совпадать ПОЛНОСТЬЮ: все суффиксы (F, GC, D2, D3, K, L, M, N, H, B, C, T, T2, RM, LC, NL, GLE, MH и т.д.) — часть модели.
• Заполнять поле source общей фразой ("Caterpillar", "Cat SIS") — нужен конкретный документ/страница каталога.
• Возвращать модель без source_url ИЛИ catalog_id.
• Расширять OEM-каталог: если каталог содержит только "CAT 320GC", нельзя добавлять "320", "320D", "320D2".

✅ ЕДИНСТВЕННЫЙ ИСТОЧНИК ДЛЯ catalog_compatibility
Официальный parts-каталог OEM-производителя данного артикула:
Caterpillar SIS / parts.cat.com, Komatsu Parts Book / Komatsu CSS-Net, Volvo Prosis / Volvo Parts, Hitachi Parts Manager Pro / Hitachi Parts, JCB ServiceMaster / JCB Parts Pro, Case Parts Store / CNH EPC, John Deere JDParts, Hyundai HCE e-Service, Doosan DoosanParts, Liebherr LiDAT / Liebherr Parts, Cummins QuickServe Online, Perkins SPI2, Shantui / XCMG / SDLG / LiuGong официальные каталоги.
Никакие другие источники не пригодны для catalog_compatibility.

────────────────────
ЭТАПЫ (строго по порядку — не смешивать):
1) Нормализуй артикул: "3621163" ≡ "362-1163" ≡ "362 1163". Верни каноническую форму.
2) Определи OEM-производителя по официальному parts-каталогу — того, кто выпустил ЭТОТ артикул.
3) Проверь существование артикула в OEM parts-каталоге производителя.
   • Если артикул НЕ найден в OEM-каталоге → article_found=false, official_info=null, catalog_compatibility=[], company_compatible_equipment=[].
4) Извлеки официальное английское название детали ровно как в каталоге ("FILTER AS-OIL", "ELEMENT AS-FILTER"). Не сокращать. name_source обязателен.
5) name_ru — качественный технический перевод официального английского названия.
6) manufacturer_ru — формат "Caterpillar (Катерпиллар)". manufacturer_source обязателен.
7) Кросс-номера — из Donaldson/Baldwin/Fleetguard/MANN/WIX/Sakura/HIFI/Hengst/Bosch/Fram/TecDoc. Только справка об аналогах. НЕ используются для catalog_compatibility.
8) Официальный список совместимой техники ИМЕННО для этого OEM-артикула — процитируй из parts-каталога. Для КАЖДОЙ модели ОБЯЗАТЕЛЬНО:
   • brand — как в каталоге,
   • model — полностью со всеми суффиксами,
   • source — точная человекочитаемая ссылка на запись каталога (например "Caterpillar SIS — Part 362-1163, Compatible Equipment list"),
   • source_url — прямой URL страницы каталога, если она доступна публично (parts.cat.com, komatsu-parts.com и т.п.); если публичного URL нет — null,
   • catalog_id — идентификатор записи в каталоге (SIS Part ID, EPC reference), если есть; иначе null,
   • ХОТЯ БЫ ОДНО ИЗ source_url или catalog_id ДОЛЖНО быть непустым — иначе НЕ включать модель,
   • retrieved_at — дата обращения к каталогу в формате YYYY-MM-DD (сегодня).
9) Сопоставь catalog_compatibility с парком компании — только точные совпадения brand+model (с суффиксами).

⛔ Никаких выводов на основании похожести. Никаких «вероятно совместимо». Только цитата из каталога.

────────────────────
ВХОДНЫЕ ДАННЫЕ
• Артикул (сырой): ${article || "—"}
• Артикул (нормализованный): ${articleNorm || "—"}
• Производитель (подсказка, может быть неверной): ${manufacturer || "—"}
• Кросс-номер: ${cross_number || "—"}
• Наименование (подсказка): ${name || "—"}
• Тип позиции: ${kind === "filter" ? "фильтрующий элемент" : "запасная часть"}
• Сегодня: ${new Date().toISOString().slice(0, 10)}

ПАРК ТЕХНИКИ КОМПАНИИ (выбирай ТОЛЬКО из этих id и только если brand+model точно есть в catalog_compatibility):
${eqLabels.map((e) => `${e.id} — ${e.brand} ${e.model}${e.plate ? ` (${e.plate})` : ""}${e.year ? ` [${e.year}]` : ""}`).join("\n") || "— парк пуст"}

Верни СТРОГО JSON без пояснений:
{
  "article_found": true|false,
  "article_normalized": string|null,
  "sources": [{"name": "Caterpillar SIS", "trust": "green|yellow|orange|red"}],
  "official_info": {
    "part_type_ru": string|null,
    "name_en": string|null,
    "name_ru": string|null,
    "name_source": string|null,
    "manufacturer_en": string|null,
    "manufacturer_ru": string|null,
    "manufacturer_source": string|null,
    "description_ru": string|null,
    "oems": [string],
    "cross_numbers": [string]
  } | null,
  "catalog_compatibility": [
    {
      "brand": string,
      "model": string,
      "years": string|null,
      "engine": string|null,
      "source": string,
      "source_url": string|null,
      "catalog_id": string|null,
      "retrieved_at": string
    }
  ],
  "company_compatible_equipment": [
    {
      "id": string,
      "confirmation_type": "OEM",
      "sources": [string],
      "source_url": string|null,
      "catalog_id": string|null,
      "retrieved_at": string
    }
  ],
  "trust_level": "green|yellow|orange|red",
  "trust_reason": string,
  "note": string|null
}

Если article_found=false — official_info=null, catalog_compatibility=[], company_compatible_equipment=[].
Если для модели не удаётся дать ни source_url, ни catalog_id — НЕ включай её (даже если помнишь, что она где-то была). Пустой массив предпочтительнее ошибки.`;


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
            const valid = new Map((equipment ?? []).map((e: any) => [e.id, e]));
            const catalog: any[] = Array.isArray(ai.catalog_compatibility) ? ai.catalog_compatibility : [];
            const normModel = (s: any) => String(s ?? "").toUpperCase().replace(/[\s\-_./]/g, "").trim();
            const nonEmpty = (v: any) => typeof v === "string" && v.trim().length > 0;
            // Strict: brand+model + source + (source_url OR catalog_id) + retrieved_at
            const validCatalog = catalog.filter(
              (c) =>
                c &&
                nonEmpty(c.brand) &&
                nonEmpty(c.model) &&
                nonEmpty(c.source) &&
                (nonEmpty(c.source_url) || nonEmpty(c.catalog_id)) &&
                nonEmpty(c.retrieved_at)
            );
            const catalogByKey = new Map<string, any>();
            validCatalog.forEach((c) => {
              catalogByKey.set(`${normModel(c.brand)}|${normModel(c.model)}`, c);
            });
            ai.catalog_compatibility = validCatalog;

            const rawEntries: any[] = Array.isArray(ai.company_compatible_equipment)
              ? ai.company_compatible_equipment
              : [];

            ai.company_compatible_equipment = rawEntries
              .filter((e: any) => {
                if (!e || typeof e.id !== "string") return false;
                const eq = valid.get(e.id);
                if (!eq) return false;
                if (e.confirmation_type && e.confirmation_type !== "OEM") return false;
                const key = `${normModel(eq.brand)}|${normModel(eq.model)}`;
                const cat = catalogByKey.get(key);
                if (!cat) return false;
                const sources: string[] = Array.isArray(e.sources) ? e.sources.filter(Boolean) : [];
                if (!sources.length) return false;
                // Must carry either a URL or a catalog_id (inherit from catalog entry if AI omitted)
                const source_url = nonEmpty(e.source_url) ? e.source_url : cat.source_url ?? null;
                const catalog_id = nonEmpty(e.catalog_id) ? e.catalog_id : cat.catalog_id ?? null;
                if (!nonEmpty(source_url) && !nonEmpty(catalog_id)) return false;
                const retrieved_at = nonEmpty(e.retrieved_at) ? e.retrieved_at : cat.retrieved_at ?? null;
                if (!nonEmpty(retrieved_at)) return false;
                e._source_url = source_url;
                e._catalog_id = catalog_id;
                e._retrieved_at = retrieved_at;
                return true;
              })
              .map((e: any) => ({
                id: e.id,
                confirmation_type: "OEM",
                sources: (Array.isArray(e.sources) ? e.sources : []).filter(Boolean),
                source_url: e._source_url ?? null,
                catalog_id: e._catalog_id ?? null,
                retrieved_at: e._retrieved_at ?? null,
              }));

            if (ai.trust_level === "red" || catalogByKey.size === 0) {
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
            confirmation_type: "OEM",
            source_url: entry.source_url ?? null,
            catalog_id: entry.catalog_id ?? null,
            retrieved_at: entry.retrieved_at ?? null,
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
