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

🔑 ГЛАВНОЕ ПРАВИЛО (не нарушать):
Совместимость строится ТОЛЬКО в такой последовательности:
   OEM-артикул → официальный список техники OEM-производителя → сравнение с парком компании.

⛔ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
• Определять совместимость по описанию детали, типу фильтра, названию, или по кросс-номерам (Donaldson/Baldwin/Fleetguard/MANN/WIX/Sakura/HIFI/Hengst/Bosch/Fram и т.п.). Кросс-номера служат ТОЛЬКО для отображения аналогов, но НЕ расширяют список совместимой техники.
• Придумывать совместимость и данные.
• Делать выводы вида «если производитель CAT — значит подходит ко всему CAT».
• Расширять модель: если официальный OEM-каталог содержит "CAT 420F" — НЕЛЬЗЯ добавлять "CAT 420" / "420E" / "420F IT". Если "CAT 320GC" — НЕЛЬЗЯ "CAT 320". Если "CAT 320D2" — НЕЛЬЗЯ "CAT 320D". Модель должна совпадать ПОЛНОСТЬЮ (со всеми суффиксами: F, GC, D2, K, L, M, N, H, B, C, T, T2 и т.д.).
• Использовать эвристики по названию или по типу фильтра.
• Помечать модель как совместимую только на основании кросс-референса.

Точность важнее количества. Лучше ноль моделей, чем одна неправильная. Если официального подтверждения нет — возвращай пустой массив.

✅ ИСТОЧНИКИ ДАННЫХ:
• Для официального списка совместимой техники (catalog_compatibility) — ТОЛЬКО официальный каталог OEM-производителя данного артикула:
  Caterpillar Parts / SIS, Komatsu Parts Book, Volvo Prosis, Hitachi Parts, JCB Parts Pro, Case Parts Store, John Deere Parts Catalog, Hyundai Parts, Doosan Parts, Liebherr LiDAT/Parts, Cummins QuickServe, Perkins SPI, Shantui, XCMG, SDLG, LiuGong.
• Кросс-номера (для поля official_info.cross_numbers) — Donaldson, Baldwin, Fleetguard, MANN Filter, WIX, Sakura, HIFI Filter, Hengst, Bosch, Fram, TecDoc. Эти источники НИКОГДА не используются для формирования catalog_compatibility.

Если артикул не найден в OEM-каталоге — article_found=false, catalog_compatibility=[], company_compatible_equipment=[].

────────────────────
ЭТАПЫ ОБРАБОТКИ (строго по порядку — НЕ ПРИДУМЫВАТЬ):
1) Нормализуй артикул: "3621163", "362-1163", "362 1163" — это ОДИН и тот же артикул. Верни каноническую форму (например "362-1163").
2) Определи OEM-производителя по артикулу (кто выпустил данный артикул) — ТОЛЬКО по официальному каталогу. Запиши источник в manufacturer_source (например "Caterpillar SIS / parts.cat.com").
3) Проверь существование артикула в OEM-каталоге этого производителя. Если не найден — article_found=false, остальные поля пустые.
4) Получи ОФИЦИАЛЬНОЕ английское название детали из каталога — точно так, как оно записано (например "FILTER AS-OIL", "FILTER GP-HYDRAULIC", "ELEMENT AS-FILTER"). Запиши источник в name_source (например "Caterpillar SIS — 362-1163"). Не сокращать и не переформулировать.
5) Приоритет источников для manufacturer/name:
   (a) OEM-каталог производителя,
   (b) Официальные каталоги аналогов (Donaldson, Fleetguard, Baldwin, MANN, WIX, Sakura, HIFI, Hengst, Bosch, Fram, TecDoc),
   (c) Только если ни в одном каталоге официального названия нет — выполнить качественный технический перевод самостоятельно и пометить name_source = "AI translation (fallback)".
6) name_ru — качественный технический перевод официального английского названия ("Гидравлический фильтр", "Трансмиссионный фильтр", "Гидравлический / трансмиссионный фильтр", "Масляный фильтр двигателя", "Топливный фильтр", "Фильтр воздуха кабины", "Основной воздушный фильтр", "Внутренний воздушный фильтр" и т.п.). Если source = OEM/аналоги — это перевод их официального названия; если source = AI translation — это твой перевод.
7) Получи кросс-номера из проверенных источников (Donaldson/Baldwin/Fleetguard/MANN/WIX...). Это ТОЛЬКО справочная информация об аналогах — НЕ расширяют совместимость техники.
8) Получи официальный список техники ИМЕННО для этого OEM-артикула из OEM-каталога. Это единственный источник для catalog_compatibility. Для каждой модели укажи конкретный источник (например "Caterpillar SIS / Parts.cat.com — 362-1163").
9) Сопоставь catalog_compatibility с парком компании: возьми только те машины из парка, у которых brand И model точно (с суффиксами) присутствуют в catalog_compatibility.

⛔ ЗАПРЕЩЕНО придумывать производителя или наименование. Оба поля ОБЯЗАНЫ иметь source. Если ни один источник не подтверждает — оставь пустым.

────────────────────
ВХОДНЫЕ ДАННЫЕ
• Артикул (сырой): ${article || "—"}
• Артикул (нормализованный): ${articleNorm || "—"}
• Производитель (подсказка, может быть неверной): ${manufacturer || "—"}
• Кросс-номер: ${cross_number || "—"}
• Наименование (подсказка): ${name || "—"}
• Тип позиции: ${kind === "filter" ? "фильтрующий элемент" : "запасная часть"}

ПАРК ТЕХНИКИ КОМПАНИИ (выбирай ТОЛЬКО из этих id и только если модель точно есть в catalog_compatibility):
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
    {"brand": string, "model": string, "years": string|null, "engine": string|null, "source": string}
  ],
  "company_compatible_equipment": [
    {"id": string, "confirmation_type": "OEM", "sources": [string]}
  ],
  "trust_level": "green|yellow|orange|red",
  "trust_reason": string,
  "note": string|null
}

Правила заполнения:
• manufacturer_ru — формат "Caterpillar (Катерпиллар)", "Donaldson (Дональдсон)", "Fleetguard (Флитгард)", "Baldwin (Болдуин)".
• manufacturer_source и name_source — ОБЯЗАТЕЛЬНЫ, если заполнены соответствующие поля. Значения — конкретный каталог (например "Caterpillar SIS", "Donaldson Catalog", "MANN-Filter Online Catalog") или "AI translation (fallback)" для name_source, если официального названия нет ни в одном источнике.
• name_en — точная строка из каталога (без изменений), например "FILTER AS-OIL".
• name_ru — качественный технический перевод.
• В catalog_compatibility поле source ОБЯЗАТЕЛЬНО и должно быть конкретным источником OEM-каталога (не "Donaldson", не "Baldwin").
• В company_compatible_equipment confirmation_type ВСЕГДА "OEM" (Cross Reference НЕ используется для равнения техники). sources — конкретные OEM-источники, подтверждающие ЭТУ модель для ЭТОГО артикула.
• Если catalog_compatibility пуст — company_compatible_equipment ОБЯЗАН быть пустым.
• trust_level: green — подтверждено в OEM SIS/Parts Catalog; yellow — подтверждено в OEM, но источник вторичный; orange — только косвенно; red — не подтверждено (тогда catalog_compatibility и company_compatible_equipment пустые).

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
            const valid = new Map((equipment ?? []).map((e: any) => [e.id, e]));
            const catalog: any[] = Array.isArray(ai.catalog_compatibility) ? ai.catalog_compatibility : [];
            const normModel = (s: any) => String(s ?? "").toUpperCase().replace(/[\s\-_./]/g, "").trim();
            // Only catalog entries with a concrete OEM source count
            const validCatalog = catalog.filter(
              (c) => c && c.brand && c.model && typeof c.source === "string" && c.source.trim()
            );
            const catalogKeys = new Set(
              validCatalog.map((c) => `${normModel(c.brand)}|${normModel(c.model)}`)
            );
            ai.catalog_compatibility = validCatalog;

            const rawEntries: any[] = Array.isArray(ai.company_compatible_equipment)
              ? ai.company_compatible_equipment
              : [];

            ai.company_compatible_equipment = rawEntries
              .filter((e: any) => {
                if (!e || typeof e.id !== "string") return false;
                const eq = valid.get(e.id);
                if (!eq) return false;
                // OEM-only confirmation
                if (e.confirmation_type && e.confirmation_type !== "OEM") return false;
                // Model must be present in the OEM catalog list (exact brand+model match)
                const key = `${normModel(eq.brand)}|${normModel(eq.model)}`;
                if (!catalogKeys.has(key)) return false;
                const sources: string[] = Array.isArray(e.sources) ? e.sources.filter(Boolean) : [];
                return sources.length > 0;
              })
              .map((e: any) => ({
                id: e.id,
                confirmation_type: "OEM",
                sources: (Array.isArray(e.sources) ? e.sources : []).filter(Boolean),
              }));

            if (ai.trust_level === "red" || catalogKeys.size === 0) {
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
