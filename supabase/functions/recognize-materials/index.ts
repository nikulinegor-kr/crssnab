import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { encodeBase64 } from "jsr:@std/encoding/base64";

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

    const MAX_SOURCE_PDF_BYTES = 45 * 1024 * 1024;
    const AI_TARGET_CHUNK_BYTES = 10 * 1024 * 1024;
    const AI_HARD_CHUNK_BYTES = 12 * 1024 * 1024;

    const sourceTooLargeError = "Файл слишком большой для распознавания в облаке (макс. 45 МБ). Сожмите или разбейте PDF.";

    const downloadPdfWithCap = async (url: string, maxBytes: number): Promise<Uint8Array> => {
      let headSize: number | null = null;

      try {
        const headResponse = await fetch(url, { method: "HEAD" });
        if (headResponse.ok) {
          const header = headResponse.headers.get("content-length");
          headSize = header ? Number(header) : null;
        }
      } catch {
        // Some hosts can block HEAD.
      }

      if (headSize !== null && Number.isFinite(headSize) && headSize > maxBytes) {
        throw new Error(sourceTooLargeError);
      }

      const pdfResponse = await fetch(url);
      if (!pdfResponse.ok || !pdfResponse.body) {
        throw new Error("Failed to download PDF");
      }

      const lengthHeader = pdfResponse.headers.get("content-length");
      const declaredSize = lengthHeader ? Number(lengthHeader) : null;
      if (declaredSize !== null && Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        throw new Error(sourceTooLargeError);
      }

      const reader = pdfResponse.body.getReader();

      if (declaredSize !== null && Number.isFinite(declaredSize) && declaredSize > 0) {
        const bytes = new Uint8Array(declaredSize);
        let offset = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          offset += value.length;
          if (offset > maxBytes) {
            await reader.cancel();
            throw new Error(sourceTooLargeError);
          }
          bytes.set(value, offset - value.length);
        }

        return offset === bytes.length ? bytes : bytes.slice(0, offset);
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new Error(sourceTooLargeError);
        }

        chunks.push(value);
      }

      const pdfBytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        pdfBytes.set(chunk, offset);
        offset += chunk.length;
      }
      return pdfBytes;
    };

    const splitPdfForAi = async (pdfBytes: Uint8Array): Promise<Uint8Array[]> => {
      if (pdfBytes.byteLength <= AI_HARD_CHUNK_BYTES) {
        return [pdfBytes];
      }

      const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const totalPages = sourceDoc.getPageCount();

      if (totalPages <= 1) {
        throw new Error("PDF содержит слишком тяжёлую страницу для распознавания в облаке. Сожмите файл.");
      }

      const estimatedChunks = Math.max(2, Math.ceil(pdfBytes.byteLength / AI_TARGET_CHUNK_BYTES));
      const initialPagesPerChunk = Math.max(1, Math.ceil(totalPages / estimatedChunks));
      const chunks: Uint8Array[] = [];

      let pageCursor = 0;
      while (pageCursor < totalPages) {
        const remaining = totalPages - pageCursor;
        let candidatePages = Math.min(initialPagesPerChunk, remaining);

        let selectedBytes: Uint8Array | null = null;
        let selectedPageCount = 0;

        while (candidatePages > 0) {
          const chunkDoc = await PDFDocument.create();
          const pageIndexes = Array.from({ length: candidatePages }, (_, i) => pageCursor + i);
          const pages = await chunkDoc.copyPages(sourceDoc, pageIndexes);
          for (const page of pages) chunkDoc.addPage(page);

          const candidateBytes = await chunkDoc.save({ useObjectStreams: true });
          if (candidateBytes.byteLength <= AI_HARD_CHUNK_BYTES) {
            selectedBytes = candidateBytes;
            selectedPageCount = candidatePages;
            break;
          }

          candidatePages -= 1;
        }

        if (!selectedBytes || selectedPageCount === 0) {
          throw new Error("Не удалось безопасно разбить PDF для распознавания. Сожмите файл и повторите.");
        }

        chunks.push(selectedBytes);
        pageCursor += selectedPageCount;
      }

      return chunks;
    };

    const parseRowsWithRecovery = (text: string): any[] | null => {
      const start = text.indexOf("[");
      if (start === -1) return null;
      const fromArray = text.slice(start);

      const lastBracket = fromArray.lastIndexOf("]");
      if (lastBracket > 0) {
        const fullCandidate = fromArray.slice(0, lastBracket + 1);
        try {
          const parsed = JSON.parse(fullCandidate);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          // Continue to recovery.
        }
      }

      let inString = false;
      let escaped = false;
      let objectDepth = 0;
      const completeObjectEndIndices: number[] = [];

      for (let i = 0; i < fromArray.length; i++) {
        const ch = fromArray[i];

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === "{") {
          objectDepth++;
        } else if (ch === "}" && objectDepth > 0) {
          objectDepth--;
          if (objectDepth === 0) completeObjectEndIndices.push(i);
        }
      }

      for (let idx = completeObjectEndIndices.length - 1; idx >= 0; idx--) {
        const end = completeObjectEndIndices[idx];
        const candidate = `${fromArray.slice(0, end + 1).replace(/,\s*$/, "")}]`;
        try {
          const parsed = JSON.parse(candidate);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          // Try earlier object boundary.
        }
      }

      return null;
    };

    const normalizeAiJson = (text: string): string => {
      let normalized = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      const fixLocaleCommas = (value: string): string =>
        value.replace(/(:\s*-?)(\d+),(\d+)(\s*[,\}\]\s\n\r])/g, "$1$2.$3$4");

      const firstPass = fixLocaleCommas(normalized);
      normalized = firstPass === normalized ? normalized : fixLocaleCommas(firstPass);

      return normalized;
    };

    const prompt = `Ты эксперт по распознаванию ведомостей материалов из строительных и промышленных PDF-документов.

Проанализируй этот PDF документ и извлеки строки таблицы материалов.

Документ может содержать РАЗНЫЕ форматы таблиц. Вот основные:

ФОРМАТ 1 — Ведомость материалов (8 столбцов):
1 — Позиция → "position"
2 — Наименование и техническая характеристика → "name"
3 — Тип, марка, обозначение документа → "type_mark"
4 — Код оборудования (ИГНОРИРОВАТЬ)
5 — Единица измерения → "unit"
6 — Количество → "quantity"
7 — Масса единицы, кг → "mass_per_unit"
8 — Примечания (ИГНОРИРОВАТЬ)

ФОРМАТ 2 — Спецификация (например «Спецификация металла», «Спецификация бетонных блоков» и т.п.):
Столбцы могут включать: № п.п., Марка, Обозначение, Наименование, Масса ед. кг, кол-во шт, масса кг, Объем м³
Сопоставляй так:
- "№ п.п." → "position"
- "Наименование" → "name"
- "Марка" и/или "Обозначение" → "type_mark" (объедини через пробел если оба есть)
- "Масса ед." → "mass_per_unit"
- "кол-во" или "Кол-во, шт" → "quantity"
- "Ед. изм." → "unit" (если нет отдельного столбца, определи из заголовка таблицы: шт, м³, кг, т, м.п. и т.д.)

ФОРМАТ 3 — Любая другая табличная структура с материалами:
Адаптируйся к заголовкам. Главное — извлечь name, type_mark, unit, quantity, mass_per_unit.

ВАЖНО:
- Если в документе НЕСКОЛЬКО таблиц (например «Спецификация металла» и «Спецификация бетонных блоков»), извлеки материалы из ВСЕХ таблиц.
- Строки-заголовки подтаблиц (например «Труба 3") записывай НЕ как отдельные позиции, а добавляй как префикс к name следующих строк. Пример: если заголовок «Труба 3» и позиция «Средняя секция трубы L=5,50м", то name = «Труба 3 — Средняя секция трубы L=5,50м».
- НЕ объединяй строки самостоятельно (кроме подзаголовков выше).
- Верни СЫРЫЕ строки в том же порядке, как в таблице.
- СНАЧАЛА извлеки номер позиции из столбца «Позиция» / «№ п.п.» для КАЖДОЙ строки.
- Для строк-продолжений position может быть null/пусто.
- Игнорируй полностью пустые строки и строки-заголовки таблиц (не подзаголовки групп).

Гибкое сопоставление заголовков:
- "Наименование" или "Наименование и техническая характеристика" → name
- "Тип" или "Тип, марка" или "Обозначение" или "Марка" → type_mark
- "Ед. изм." или "Единица измерения" → unit
- "Кол-во" или "Количество" или "кол-во, шт" → quantity
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

    const recognizeChunk = async (
      chunkBytes: Uint8Array,
      chunkIndex: number,
      totalChunks: number,
    ): Promise<any[]> => {
      const pdfBase64 = encodeBase64(chunkBytes);

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
        console.error("AI API error:", errText, { chunkIndex, totalChunks });
        throw new Error(`AI recognition failed on part ${chunkIndex}/${totalChunks}`);
      }

      const aiData = await aiResponse.json();
      const finishReason = aiData.choices?.[0]?.finish_reason;
      const normalizedContent = normalizeAiJson(aiData.choices?.[0]?.message?.content || "[]");
      const parsedRows = parseRowsWithRecovery(normalizedContent);

      if (!parsedRows) {
        console.error("Failed to parse AI response", {
          chunkIndex,
          totalChunks,
          finishReason,
          preview: normalizedContent.substring(0, 500),
        });
        throw new Error(`Failed to parse AI response on part ${chunkIndex}/${totalChunks}`);
      }

      if (finishReason && finishReason !== "stop") {
        console.warn("AI response may be truncated, recovered partial JSON", {
          chunkIndex,
          totalChunks,
          finishReason,
          recoveredCount: parsedRows.length,
        });
      }

      return parsedRows;
    };

    const pdfBytes = await downloadPdfWithCap(fileUrl, MAX_SOURCE_PDF_BYTES);
    const pdfChunks = await splitPdfForAi(pdfBytes);

    const rawRows: any[] = [];
    for (let i = 0; i < pdfChunks.length; i++) {
      const chunkRows = await recognizeChunk(pdfChunks[i], i + 1, pdfChunks.length);
      rawRows.push(...chunkRows);
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
      if (!Number.isFinite(pos) || pos <= 0 || pos > MAX_REASONABLE_POSITION) return null;
      return pos;
    };

    const parsePosition = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return sanitizePosition(value);
      const s = normalizeText(value).replace(/\u00A0/g, " ");
      if (!s) return null;

      const direct = s.match(/^(\d{1,4}(?:[.,]\d+)?)(?:[.)])?$/);
      if (direct) {
        return sanitizePosition(parseFloat(direct[1].replace(",", ".")));
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

    // Determine if a null-position row is a standalone item vs a continuation of the previous row.
    // A standalone item has its own name AND has unit or quantity (it's a complete material entry).
    // A continuation row typically has only partial text and no unit/quantity.
    const isStandaloneRow = (row: ParsedRow): boolean => {
      if (!row.name) return false;
      // If it has unit or quantity, it's a complete item
      if (row.unit || row.quantity !== null) return true;
      return false;
    };

    const groupedRows: GroupedRow[] = [];
    const leadingRows: ParsedRow[] = [];
    let currentGroup: GroupedRow | null = null;
    let autoPosition = 10000; // auto-assigned positions for standalone null-position rows

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

      // Null-position row: check if it's a standalone item or a continuation
      if (isStandaloneRow(row)) {
        // This is a separate material item, not a continuation
        if (currentGroup) groupedRows.push(currentGroup);
        autoPosition++;
        currentGroup = { ...row, position: autoPosition };
      } else if (currentGroup) {
        // True continuation — merge text into current group
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
