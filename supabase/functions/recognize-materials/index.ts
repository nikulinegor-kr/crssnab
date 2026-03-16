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
- СНАЧАЛА извлеки номер позиции из столбца 1 («Позиция») для КАЖДОЙ строки таблицы.
- Даже если номер в ячейке «Позиция» стоит не в начале (после пробелов/переносов/служебного текста), поле "position" всё равно должно содержать этот номер.
- Не переноси номер позиции в поле "name", если он найден в столбце 1.
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
КРИТИЧЕСКИ ВАЖНО: Все числа ОБЯЗАТЕЛЬНО записывай через ТОЧКУ (например 2.03, а НЕ 2,03). Это касается quantity и mass_per_unit. Иначе JSON будет невалидным.
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

    // Fix Russian-locale commas in numeric values BEFORE parsing
    // Matches patterns like: 2,03  0,2  12,4  1,745 when used as JSON number values
    // Only replaces comma between digits that appear after ":" (JSON value position)
    const fixLocaleCommas = (text: string): string => {
      // Replace commas used as decimal separators in JSON numeric values
      // Pattern: after colon and optional whitespace, digits-comma-digits, followed by comma/}/]/whitespace
      return text.replace(/(?<=:\s*-?)(\d+),(\d+)(?=\s*[,\}\]\n\r])/g, '$1.$2');
    };

    content = fixLocaleCommas(content);

    let rawRows: any[];
    try {
      rawRows = JSON.parse(content);
    } catch {
      // Attempt to recover truncated JSON
      const lastBrace = content.lastIndexOf("}");
      if (lastBrace > 0) {
        const repaired = content.substring(0, lastBrace + 1) + "]";
        try {
          rawRows = JSON.parse(repaired);
          console.warn(`Recovered ${rawRows.length} items from truncated response`);
        } catch {
          console.error("Failed to parse AI response (after recovery attempt):", content.substring(0, 500));
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 1000) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.error("Failed to parse AI response:", content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 1000) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    const MAX_REASONABLE_POSITION = 500;

    const sanitizePosition = (pos: number | null): number | null => {
      if (pos === null) return null;
      if (!Number.isInteger(pos) || pos <= 0 || pos > MAX_REASONABLE_POSITION) return null;
      return pos;
    };

    const parsePosition = (value: any): number | null => {
      const s = normalizeText(value).replace(/\u00A0/g, " ");
      if (!s) return null;

      const direct = s.match(/^(\d{1,4})(?:[.)])?$/);
      if (direct) {
        return sanitizePosition(Number(direct[1]));
      }

      const embedded = s.match(/(?:^|\D)(\d{1,4})(?:\D|$)/);
      if (!embedded) return null;
      return sanitizePosition(Number(embedded[1]));
    };

    const extractLeadingPositionFromName = (name: string): { position: number | null; cleanName: string } => {
      const match = name.match(/^(\d{1,4})(?:\s*[.)-])?\s+(.+)$/);
      if (!match) return { position: null, cleanName: name };
      return {
        position: sanitizePosition(Number(match[1])),
        cleanName: match[2].trim(),
      };
    };

    type ParsedRow = {
      position: number | null;
      name: string;
      type_mark: string | null;
      unit: string | null;
      quantity: number | null;
      mass_per_unit: number | null;
    };

    type GroupedRow = ParsedRow & { position: number };

    const normalizedRows: ParsedRow[] = rawRows
      .map((row: any) => {
        const rawName = normalizeText(row?.name);
        const columnPosition = parsePosition(row?.position);
        const fallbackFromName = columnPosition === null
          ? extractLeadingPositionFromName(rawName)
          : { position: null, cleanName: rawName };

        return {
          position: columnPosition ?? fallbackFromName.position,
          name: fallbackFromName.cleanName,
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

    const mergeText = (left: string | null | undefined, right: string | null | undefined): string =>
      [left || "", right || ""].filter(Boolean).join(" ").trim();

    const mergeIntoGroup = (target: GroupedRow, source: ParsedRow) => {
      target.name = mergeText(target.name, source.name);
      target.type_mark = mergeText(target.type_mark, source.type_mark) || null;
      if (!target.unit && source.unit) target.unit = source.unit;
      if (target.quantity === null && source.quantity !== null) target.quantity = source.quantity;
      if (target.mass_per_unit === null && source.mass_per_unit !== null) {
        target.mass_per_unit = source.mass_per_unit;
      }
    };

    const groupedRows: GroupedRow[] = [];
    const leadingRows: ParsedRow[] = [];
    let currentGroup: GroupedRow | null = null;

    for (const row of normalizedRows) {
      if (row.position !== null) {
        if (currentGroup && row.position === currentGroup.position) {
          mergeIntoGroup(currentGroup, row);
          continue;
        }

        if (currentGroup) groupedRows.push(currentGroup);
        currentGroup = { ...row, position: row.position };
        continue;
      }

      if (currentGroup) {
        // Позиция N = все строки до позиции N+1
        mergeIntoGroup(currentGroup, row);
      } else {
        leadingRows.push({ ...row });
      }
    }

    if (currentGroup) groupedRows.push(currentGroup);

    const positionSequence = groupedRows.map((row) => row.position);
    const missingPositions: number[] = [];
    const outOfOrderTransitions: Array<{ from: number; to: number }> = [];

    for (let i = 1; i < positionSequence.length; i++) {
      const prev = positionSequence[i - 1];
      const next = positionSequence[i];

      if (next > prev + 1) {
        for (let p = prev + 1; p < next; p++) {
          missingPositions.push(p);
          if (missingPositions.length >= 5000) break;
        }
      } else if (next < prev) {
        outOfOrderTransitions.push({ from: prev, to: next });
      }
    }

    const warnings: string[] = [];
    if (missingPositions.length > 0) {
      const sample = missingPositions.slice(0, 25).join(", ");
      const tail = missingPositions.length > 25 ? ", ..." : "";
      warnings.push(
        `Обнаружены пропущенные позиции: ${sample}${tail} (всего: ${missingPositions.length}).`
      );
    }

    if (outOfOrderTransitions.length > 0) {
      const sample = outOfOrderTransitions
        .slice(0, 10)
        .map((t) => `${t.from}→${t.to}`)
        .join(", ");
      warnings.push(`Обнаружены непоследовательные переходы позиций: ${sample}.`);
    }

    if (leadingRows.length > 0) {
      warnings.push(
        `Есть ${leadingRows.length} строк(и) до первой распознанной позиции — проверьте колонку «Позиция».`
      );
    }

    if (groupedRows.length === 0 && normalizedRows.length > 0) {
      warnings.push("Не удалось извлечь номера позиций из колонки «Позиция». Проверьте качество исходного файла.");
    }

    const materials = groupedRows.length > 0
      ? [...leadingRows, ...groupedRows.map(({ position, ...row }) => row)]
      : normalizedRows.map(({ position, ...row }) => row);

    console.log("Recognition diagnostics:", JSON.stringify({
      strategy: "position_ranges",
      rawRows: rawRows.length,
      normalizedRows: normalizedRows.length,
      groupedRows: groupedRows.length,
      leadingRows: leadingRows.length,
      finalRows: materials.length,
      positionSequenceSample: positionSequence.slice(0, 20),
      missingPositionsSample: missingPositions.slice(0, 20),
      outOfOrderTransitions: outOfOrderTransitions.slice(0, 10),
      warningsCount: warnings.length,
    }));

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
      JSON.stringify({
        success: true,
        count: materials.length,
        materials,
        warnings,
        missingPositions,
      }),
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
