import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, statementId, organizationId } = await req.json();

    if (!fileUrl || !statementId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "fileUrl, statementId, organizationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the PDF file
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfArrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const prompt = `Ты эксперт по распознаванию ведомостей материалов из строительных и промышленных PDF-документов.

Проанализируй этот PDF документ и извлеки строки таблицы материалов.

Таблица обычно имеет 8 столбцов:
1 — Позиция (извлечь во временное поле "position" для контроля)
2 — Наименование и техническая характеристика ("name")
3 — Тип, марка, обозначение документа, опросного листа ("type_mark")
4 — Код оборудования, изделия, материала (ИГНОРИРОВАТЬ)
5 — Единица измерения ("unit")
6 — Количество ("quantity")
7 — Масса единицы, кг ("mass_per_unit")
8 — Примечания (ИГНОРИРОВАТЬ)

ВАЖНО:
- НЕ объединяй строки самостоятельно.
- Верни СЫРЫЕ строки в том же порядке, как в таблице.
- Для строк-продолжений position может быть null/пусто.
- Игнорируй полностью пустые строки и строки-заголовки.

Гибкое сопоставление заголовков:
- "Наименование" или "Наименование и техническая характеристика" → name
- "Тип" или "Тип, марка" или "Обозначение" → type_mark
- "Ед. изм." или "Единица измерения" → unit
- "Кол-во" или "Количество" → quantity
- "Масса ед." или "Масса единицы" или "Масса единицы, кг" → mass_per_unit

Верни результат СТРОГО в формате JSON массива:
[
  {
    "position": 1,
    "name": "Полное наименование материала",
    "type_mark": "Тип/марка/обозначение или null",
    "unit": "шт",
    "quantity": 10,
    "mass_per_unit": 0.5
  }
]

Если quantity или mass_per_unit отсутствуют, ставь null.
Числа с запятой (напр. "1,5") передавай как есть, сервер нормализует.
Не добавляй никакого текста кроме JSON массива. Не оборачивай в markdown.`;

    // Call Lovable AI (Gemini for PDF/vision)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 64000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI recognition failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";

    // Clean markdown wrapping if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let rawRows: any[];
    try {
      rawRows = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(rawRows)) {
      rawRows = [];
    }

    const normalizeText = (value: any): string => {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\s+/g, " ").trim();
    };

    const parseLocaleNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number") return Number.isFinite(value) ? value : null;

      let s = String(value).trim().replace(/\u00A0/g, "").replace(/\s+/g, "");
      if (!s) return null;

      if (s.includes(",") && s.includes(".")) {
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
          s = s.replace(/\./g, "").replace(",", ".");
        } else {
          s = s.replace(/,/g, "");
        }
      } else if (s.includes(",")) {
        s = s.replace(",", ".");
      }

      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const parsePosition = (value: any): number | null => {
      const s = normalizeText(value).replace(/\u00A0/g, "");
      if (!s) return null;
      const match = s.match(/^(\d{1,4})(?:[.)])?$/);
      if (!match) return null;
      const pos = Number(match[1]);
      return Number.isInteger(pos) && pos > 0 ? pos : null;
    };

    const extractPositionFromName = (name: string): { position: number | null; cleanName: string } => {
      const match = name.match(/^(\d{1,4})\s*[.)]\s*(.+)$/);
      if (!match) return { position: null, cleanName: name };
      const pos = Number(match[1]);
      if (!Number.isInteger(pos) || pos <= 0) return { position: null, cleanName: name };
      return { position: pos, cleanName: match[2].trim() };
    };

    type ParsedRow = {
      position: number | null;
      name: string;
      type_mark: string | null;
      unit: string | null;
      quantity: number | null;
      mass_per_unit: number | null;
    };

    const normalizedRows: ParsedRow[] = rawRows
      .map((row: any) => {
        const rawName = normalizeText(row?.name);
        const fromName = extractPositionFromName(rawName);
        return {
          position: parsePosition(row?.position) ?? fromName.position,
          name: fromName.cleanName,
          type_mark: normalizeText(row?.type_mark) || null,
          unit: normalizeText(row?.unit) || null,
          quantity: parseLocaleNumber(row?.quantity),
          mass_per_unit: parseLocaleNumber(row?.mass_per_unit),
        };
      })
      .filter((row) =>
        row.position !== null ||
        !!row.name ||
        !!row.type_mark ||
        !!row.unit ||
        row.quantity !== null ||
        row.mass_per_unit !== null
      );

    const numericPositions = normalizedRows
      .map((r) => r.position)
      .filter((p): p is number => p !== null);

    const uniquePositions = [...new Set(numericPositions)];
    const canTrustPositions = uniquePositions.length >= Math.floor(normalizedRows.length * 0.8);

    let finalRows: ParsedRow[] = [];

    if (canTrustPositions) {
      const grouped = new Map<number, ParsedRow>();
      const orderedPositions: number[] = [];
      const orphanRows: ParsedRow[] = [];
      let currentPos: number | null = null;

      for (const row of normalizedRows) {
        if (row.position !== null) {
          currentPos = row.position;
          if (!grouped.has(currentPos)) {
            grouped.set(currentPos, { ...row });
            orderedPositions.push(currentPos);
          } else {
            const existing = grouped.get(currentPos)!;
            existing.name = [existing.name, row.name].filter(Boolean).join(" ").trim();
            existing.type_mark = [existing.type_mark || "", row.type_mark || ""].filter(Boolean).join(" ").trim() || null;
            if (!existing.unit && row.unit) existing.unit = row.unit;
            if (existing.quantity === null && row.quantity !== null) existing.quantity = row.quantity;
            if (existing.mass_per_unit === null && row.mass_per_unit !== null) existing.mass_per_unit = row.mass_per_unit;
          }
          continue;
        }

        const isContinuation = currentPos !== null && !row.unit && row.quantity === null;
        if (isContinuation && currentPos !== null) {
          const existing = grouped.get(currentPos);
          if (existing) {
            existing.name = [existing.name, row.name].filter(Boolean).join(" ").trim();
            existing.type_mark = [existing.type_mark || "", row.type_mark || ""].filter(Boolean).join(" ").trim() || null;
            if (existing.mass_per_unit === null && row.mass_per_unit !== null) {
              existing.mass_per_unit = row.mass_per_unit;
            }
            continue;
          }
        }

        orphanRows.push({ ...row });
      }

      finalRows = [...orderedPositions.map((p) => grouped.get(p)!).filter(Boolean), ...orphanRows];
    } else {
      // fallback: не схлопываем строки, чтобы не терять позиции
      finalRows = normalizedRows;
    }

    const materials = finalRows.map(({ position, ...row }) => row);

    let missingPositions: number[] = [];
    if (canTrustPositions && uniquePositions.length > 0) {
      const maxPos = Math.max(...uniquePositions);
      if (maxPos <= 1000) {
        const set = new Set(uniquePositions);
        for (let i = 1; i <= maxPos; i++) {
          if (!set.has(i)) missingPositions.push(i);
        }
      }

      console.log("Recognition diagnostics:", JSON.stringify({
        strategy: "group_by_position",
        rawRows: rawRows.length,
        normalizedRows: normalizedRows.length,
        finalRows: finalRows.length,
        uniquePositions: uniquePositions.length,
        maxPos,
        missingPositionsSample: missingPositions.slice(0, 20),
      }));
    } else {
      console.log("Recognition diagnostics:", JSON.stringify({
        strategy: "fallback_no_merge",
        rawRows: rawRows.length,
        normalizedRows: normalizedRows.length,
        finalRows: finalRows.length,
        uniquePositions: uniquePositions.length,
      }));
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete old items for this statement
    await supabase
      .from("material_statement_items")
      .delete()
      .eq("statement_id", statementId);

    // Insert new items
    if (materials.length > 0) {
      const items = materials.map((m: any, idx: number) => ({
        statement_id: statementId,
        organization_id: organizationId,
        row_number: idx + 1,
        name: m.name || "",
        type_mark: m.type_mark || null,
        unit: m.unit || null,
        quantity: m.quantity,
        mass_per_unit: m.mass_per_unit,
      }));

      const { error: insertError } = await supabase
        .from("material_statement_items")
        .insert(items);

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save items", details: insertError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Mark statement as recognized
    await supabase
      .from("material_statements")
      .update({ is_recognized: true })
      .eq("id", statementId);

    return new Response(
      JSON.stringify({ success: true, count: materials.length, materials }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
