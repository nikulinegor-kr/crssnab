// Analyze a part (filter element or spare part) using Lovable AI
// Returns duplicates, compatible equipment suggestions, purchase history and analogs.
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
  image_base64?: string; // raw base64 (no data: prefix) OR data URL
  image_mime?: string;   // e.g. image/jpeg
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

    const table = kind === "filter" ? "filter_elements" : "spare_parts";
    const movTable = kind === "filter" ? "filter_element_movements" : "spare_part_movements";
    const compatTable = kind === "filter" ? "filter_element_equipment" : "spare_part_equipment";
    const fkCol = kind === "filter" ? "filter_element_id" : "spare_part_id";

    // 0. Photo recognition (if provided) — extract article/manufacturer/name/cross-numbers via Gemini vision
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
                { type: "text", text: `Ты эксперт по маркировке запчастей и фильтров для спецтехники. С фото детали извлеки видимые идентификаторы. Верни СТРОГО JSON: {"article": string|null, "manufacturer": string|null, "name": string|null, "cross_numbers": string[]}. Никаких пояснений вне JSON.` },
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
            name = name || vision.name || undefined;
            if (!cross_number && Array.isArray(vision.cross_numbers) && vision.cross_numbers[0]) {
              cross_number = vision.cross_numbers[0];
            }
          }
        } else {
          console.error("vision error", r.status, await r.text());
        }
      } catch (e) {
        console.error("vision failed", e);
      }
    }

    // 1. Look for existing duplicates
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

    // 2. Build data for duplicate: stock, compatible equipment
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

    // 3. Purchase history — use IN movements matching the identifiers via same part records
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

    // 4. Fetch equipment list for compatibility suggestion
    const { data: equipment } = await supabase
      .from("equipment")
      .select("id, brand, model, plate_number, year")
      .eq("organization_id", orgId)
      .limit(200);

    // 5. Ask AI
    let ai: any = null;
    if (key && searchTerms.length && (equipment?.length ?? 0) > 0) {
      const eqLabels = (equipment ?? []).map((e: any, i: number) => ({
        idx: i,
        id: e.id,
        label: `${e.brand ?? ""} ${e.model ?? ""}`.trim() + (e.plate_number ? ` (${e.plate_number})` : ""),
      }));
      const prompt = `Ты эксперт по запчастям и фильтрам для спецтехники. По введённым идентификаторам определи данные запчасти и подбери совместимую технику из СПИСКА НИЖЕ.

Ввод:
- Артикул: ${article || "—"}
- Кросс-номер: ${cross_number || "—"}
- Наименование: ${name || "—"}
- Тип: ${kind === "filter" ? "фильтрующий элемент" : "запасная часть"}

Список нашей техники (выбирай ТОЛЬКО из этих id):
${eqLabels.map((e) => `${e.id} — ${e.label}`).join("\n")}

Верни строго JSON:
{
  "manufacturer": "производитель или null",
  "name": "полное наименование или null",
  "category": "категория или null",
  "cross_numbers": ["массив известных кросс-номеров"],
  "compatible_equipment_ids": ["id из списка выше, для которых деталь подходит"],
  "analogs": ["строки-аналоги, если применимо"],
  "confidence": "high|medium|low",
  "note": "короткий комментарий на русском или null"
}
Никаких пояснений вне JSON.`;

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
          try {
            ai = JSON.parse(text);
          } catch {
            const m = text.match(/\{[\s\S]*\}/);
            if (m) ai = JSON.parse(m[0]);
          }
          // validate ids
          if (ai?.compatible_equipment_ids) {
            const valid = new Set((equipment ?? []).map((e: any) => e.id));
            ai.compatible_equipment_ids = ai.compatible_equipment_ids.filter((id: string) => valid.has(id));
          }
        } else {
          console.error("AI error", r.status, await r.text());
        }
      } catch (e) {
        console.error("AI call failed", e);
      }
    }

    // Attach labels for suggested equipment
    let suggested_equipment: any[] = [];
    if (ai?.compatible_equipment_ids?.length) {
      const eqMap = new Map((equipment ?? []).map((e: any) => [e.id, e]));
      suggested_equipment = ai.compatible_equipment_ids
        .map((id: string) => eqMap.get(id))
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
              manufacturer: ai.manufacturer ?? null,
              name: ai.name ?? null,
              category: ai.category ?? null,
              cross_numbers: Array.isArray(ai.cross_numbers) ? ai.cross_numbers : [],
              analogs: Array.isArray(ai.analogs) ? ai.analogs : [],
              confidence: ai.confidence ?? null,
              note: ai.note ?? null,
              suggested_equipment,
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
