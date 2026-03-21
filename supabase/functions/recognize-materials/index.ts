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

    // ═══════════════════════════════════════════════
    // PRE-SCAN: Detect document source type (RC/GL/MR/SPEC)
    // ═══════════════════════════════════════════════
    const classifyDocumentType = async (firstChunkBytes: Uint8Array): Promise<{ type: string; scores: Record<string, number> }> => {
      const pdfBase64 = encodeBase64(firstChunkBytes);

      const classifyPrompt = `Проанализируй этот строительный PDF-документ и определи его тип.

Просканируй ВЕСЬ документ: заголовки, названия таблиц, ключевые слова, структуру колонок.

Оцени каждый тип по баллам:

RC (конструкции — ведомость расхода стали, арматура):
+2 если есть "Ведомость расхода стали"
+1 если есть A240/A400/A500
+1 если есть Ø / диаметры арматуры
+1 если есть "Итого" в контексте стали

GL (генплан — благоустройство, озеленение):
+2 если есть "Генеральный план"
+1 если есть "Экспликация"
+1 если есть "Условные обозначения"
+1 если есть "План благоустройства"

MR (ведомость материалов — таблица с материалами):
+2 если есть таблица с колонками: Наименование | Ед. изм. | Количество
+1 если есть "Ведомость материалов"

SPEC (спецификация — перечень материалов в спецификации):
+2 если есть "Спецификация" (как заголовок таблицы)
+1 если есть разделы: "Озеленение", "Покрытия", "Тротуары"
+1 если есть конкретные материалы внутри (бетон, щебень, плитка и т.д.)

Ответь СТРОГО в JSON:
{"type": "RC", "scores": {"RC": 4, "GL": 0, "MR": 1, "SPEC": 0}}

Правила:
- Выбери тип с максимальным score
- При равенстве приоритет: MR > RC > SPEC > GL
- Не добавляй текст кроме JSON`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: classifyPrompt },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
              ],
            }],
            temperature: 0.1,
            max_tokens: 500,
          }),
        });

        if (!aiResponse.ok) {
          console.error("[classify] AI failed:", await aiResponse.text());
          return { type: "RC", scores: { RC: 0, GL: 0, MR: 0, SPEC: 0 } };
        }

        const aiData = await aiResponse.json();
        let content = (aiData.choices?.[0]?.message?.content || "{}").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const result = JSON.parse(content);
        const validTypes = ["RC", "GL", "MR", "SPEC"];
        const detectedType = validTypes.includes(result.type) ? result.type : "RC";
        console.log(`[classify] Document type: ${detectedType}, scores:`, result.scores);
        return { type: detectedType, scores: result.scores || {} };
      } catch (err) {
        console.error("[classify] Error:", err);
        return { type: "RC", scores: { RC: 0, GL: 0, MR: 0, SPEC: 0 } };
      }
    };

    const buildPromptForType = (docType: string): string => {
      const typeLabel = { RC: "КОНСТРУКЦИИ (RC)", GL: "ГЕНПЛАН (GL)", MR: "ВЕДОМОСТЬ МАТЕРИАЛОВ (MR)", SPEC: "СПЕЦИФИКАЦИЯ (SPEC)" }[docType] || docType;

      const typeInstructions = docType === "GL"
        ? `\n⚠️ ТИП ДОКУМЕНТА: ${typeLabel}
Это генплан/благоустройство. Извлекай ТОЛЬКО явно указанные материалы из таблиц (если они есть).
Если в документе только чертежи, экспликации и условные обозначения без таблиц материалов — верни пустой массив [].
Применяй режим SPECIFICATION_AS_MATERIALS если есть спецификация с материалами.\n`
        : docType === "SPEC"
        ? `\n⚠️ ТИП ДОКУМЕНТА: ${typeLabel}
Применяй режим SPECIFICATION_AS_MATERIALS — извлекай ВСЕ материалы из спецификации.
Разделы типа "Озеленение", "Покрытия", "Тротуары" — это группировка, НЕ работы.
Наименования сохраняй КАК ЕСТЬ. Единицы измерения КАК ЕСТЬ.\n`
        : docType === "MR"
        ? `\n⚠️ ТИП ДОКУМЕНТА: ${typeLabel}
Извлекай ВСЕ строки из ведомости материалов. Не фильтруй по типу (металл/неметалл).

КРИТИЧЕСКОЕ ПРАВИЛО ДЛЯ MR — ВЛОЖЕННЫЕ КОНСТРУКЦИИ:

Если строка содержит слова "Конструкция", "Тип 1", "Тип 2", "Тип 3" и т.д., 
или описывает СОСТАВ конструкции (например "Конструкция автодороги", "Конструкция тротуара"):
→ это НЕ материал, это ГРУППА (TYPE = GROUP)
→ НЕ добавлять эту строку в результат

Если после такой строки идут подпункты с конкретными материалами:
- асфальтобетон, щебень, геотекстиль, грунт, песок, бетон, плитка и т.д.
→ извлекать ТОЛЬКО эти подпункты как материалы

Иерархия нумерации:
- Если есть: 1, 1.1, 1.2 → строка "1" = группа (пропустить), строки "1.1", "1.2" = материалы (извлечь)
- Если нет вложенности (плоская таблица без подпунктов) → извлекать все строки как есть

КОНТРОЛЬ КАЧЕСТВА:
В итоговом результате НЕ ДОЛЖНО быть строк со словами "Конструкция" или "Тип N" в поле name.
Если такие строки есть — это ошибка. Удали их и извлеки вложенные материалы вместо них.\n`
        : `\n⚠️ ТИП ДОКУМЕНТА: ${typeLabel}
Извлекай металлопрокат по стандартным правилам: MASTER > DETAILS, дедупликация.\n`;

      return typeInstructions;
    };

    const prompt = (docType: string) => `Ты — инженер ПТО, а не парсер текста. Твоя задача — извлечь список материалов для ЗАКУПКИ из строительного PDF-документа.
${buildPromptForType(docType)}

═══════════════════════════════════════════════
ЭТАП 1 — АНАЛИЗ СТРУКТУРЫ ДОКУМЕНТА
═══════════════════════════════════════════════

Перед извлечением материалов СНАЧАЛА просканируй ВЕСЬ документ и найди все таблицы. Определи их типы:
- "Ведомость расхода стали"
- "Спецификация деталей"
- "Спецификация арматуры"
- "Ведомость материалов"
- "Спецификация" (общая)
- "Объемы работ"
- Любые другие таблицы с материалами

═══════════════════════════════════════════════
ЭТАП 2 — ОПРЕДЕЛЕНИЕ РОЛЕЙ ТАБЛИЦ
═══════════════════════════════════════════════

Каждой найденной таблице присвой одну из ролей:

🟢 MASTER (главная итоговая ведомость):
- "Ведомость расхода стали" БЕЗ привязки к конкретному элементу
- Содержит слово "Всего" и агрегированные итоговые значения
- Содержит классы арматуры (A240, A400) и диаметры (Ø8, Ø10, Ø12...)
- Это ИТОГОВАЯ ведомость для закупки

🟡 DETAILS (детализация — НЕ добавлять в итог если есть MASTER):
- "Спецификация арматуры на 1 элемент"
- "Спецификация" внутри конкретного элемента
- "Ведомость расхода стали" с привязкой к элементу (УМ1, УМ2, УМ3, УМ4 и т.д.)
- Любые таблицы с указанием конкретного элемента/конструкции

🟣 SPECIFICATION_AS_MATERIALS (спецификация как источник материалов):
- Применяется ТОЛЬКО если в документе НЕТ ни "Ведомости материалов", ни "Ведомости расхода стали"
- НО есть таблица "Спецификация" (общая спецификация проекта/раздела)
- В этом случае спецификация становится ОСНОВНЫМ и ЕДИНСТВЕННЫМ источником материалов
- НЕ искать дополнительные материалы в других разделах файла — всё уже здесь
- Извлекать: Наименование, Ед. изм., Количество
- Разделы в спецификации типа "Озеленение территории", "Устройство покрытий", "Тротуар", "Благоустройство" — это ГРУППИРОВКА, а НЕ работы. НЕ игнорировать содержимое этих разделов!
- Вложенные позиции (1.1, 1.2, 3.1 и т.д.) — считать ОТДЕЛЬНЫМИ материалами

🔴 IGNORE (НЕ извлекать — это НЕ металлопрокат, КРОМЕ режима SPECIFICATION_AS_MATERIALS):
- Объемы работ (м³, м²) без признаков металла
- Бетон, бетонные изделия, бетонное полотно, полотно бетонное (BeNotex и т.п.)
- Грунт, подготовка, песок, щебень, гравий
- Утеплитель, пенополистирол, минвата, изоляция
- Геотекстиль, геомембрана, геосетка
- Краска, грунтовка, лак, мастика, праймер
- Саморезы, дюбели, анкера, болты (крепёж — НЕ металлопрокат)
- Кабель, провод, электрика
- Пластиковые трубы (ПВХ, ПНД, ПП)
- Схемы и чертежи
- Строки "Итого", "Всего", суммарные строки

⚠️ ВАЖНО: В режиме SPECIFICATION_AS_MATERIALS правила IGNORE НЕ действуют!
В этом режиме извлекай ВСЕ позиции из спецификации (бетон, щебень, геотекстиль, трубы ПВХ и т.д.) — 
спецификация содержит полный перечень материалов для закупки.

В режиме без SPECIFICATION_AS_MATERIALS: модуль предназначен ТОЛЬКО для металлопроката и металлоизделий:
арматура, трубы стальные, швеллер, уголок, лист, балка, полоса, круг, профиль, проволока.
Всё остальное — ИГНОРИРОВАТЬ.

═══════════════════════════════════════════════
ЭТАП 3 — ПРАВИЛО ПРИОРИТЕТА (КРИТИЧЕСКИ ВАЖНО!)
═══════════════════════════════════════════════

ЕСЛИ найдена таблица с ролью MASTER:
→ Извлекай материалы ТОЛЬКО из неё
→ Таблицы DETAILS полностью ИГНОРИРУЙ
→ НЕ суммируй MASTER + DETAILS
→ НЕ дублируй материалы из детализации

ЕСЛИ таблицы MASTER НЕТ, НО есть "Ведомость материалов":
→ Собирай материалы из таблиц DETAILS
→ Используй "Спецификацию деталей" как основной источник

ЕСЛИ НЕТ ни MASTER, ни "Ведомости материалов", НО ЕСТЬ "Спецификация":
→ Режим SPECIFICATION_AS_MATERIALS
→ Используй спецификацию как ПОЛНЫЙ и ЕДИНСТВЕННЫЙ источник материалов
→ Извлекай ВСЕ позиции (не только металл)
→ НЕ ищи материалы в других разделах/таблицах документа

Если есть НЕСКОЛЬКО "Ведомость расхода стали":
→ Выбирай ту, где есть "Всего" и агрегированные значения
→ Таблицы с привязкой к элементам (УМ1, УМ2...) — это DETAILS, не MASTER

═══════════════════════════════════════════════
ЭТАП 3.1 — СПЕЦИАЛЬНЫЕ ПРАВИЛА КЛАССИФИКАЦИИ
═══════════════════════════════════════════════

ПРАВИЛО: "анкера из арматуры" (в ЛЮБОМ режиме):
- Если встречается формулировка "анкера из арматуры", "анкер из арматуры", "анкера арматурные":
  → ТИП: арматура (НЕ работа, НЕ крепёж!)
  → Извлечь диаметр: d10, Ø10, ∅10 → диаметр 10
  → name = "Изделия из арматуры {Класс} Ø{Диаметр}"
  → Даже если формулировка похожа на работу — это МАТЕРИАЛ
  → НЕ игнорировать, НЕ относить к крепежу

═══════════════════════════════════════════════
ЭТАП 4 — ФОРМАТЫ ТАБЛИЦ
═══════════════════════════════════════════════

ФОРМАТ 1 — Ведомость материалов (8 столбцов):
1 — Позиция → "position"
2 — Наименование и техническая характеристика → "name"
3 — Тип, марка, обозначение документа → "type_mark"
4 — Код оборудования (ИГНОРИРОВАТЬ)
5 — Единица измерения → "unit"
6 — Количество → "quantity"
7 — Масса единицы, кг → "mass_per_unit"
8 — Примечания (ИГНОРИРОВАТЬ)

ФОРМАТ 2 — Спецификация (например «Спецификация металла»):
- "№ п.п." → "position"
- "Наименование" → "name"
- "Марка" и/или "Обозначение" → "type_mark"
- "Масса ед." → "mass_per_unit"
- "кол-во" → "quantity"
- "Ед. изм." → "unit"

ФОРМАТ 3 — Любая другая табличная структура:
Адаптируйся к заголовкам. Извлеки name, type_mark, unit, quantity, mass_per_unit.

ФОРМАТ 4 — Сводная матричная таблица (Ведомость расхода стали):
Заголовки колонок содержат параметры (класс, диаметр), строки — элементы/конструкции.
Ячейки содержат количество в кг.
Каждая ячейка с числом > 0 = ОТДЕЛЬНАЯ позиция.

ФОРМАТ 5 — Спецификация деталей (чертёж с таблицей):
Колонки: "Сечение", "ГОСТ", "Длина", "Кол-во", "Масса ед.", "Масса всего"
- quantity = "Масса всего"
- unit = "кг"
- mass_per_unit = "Масса ед."
- type_mark = "ГОСТ"
- name формируется по правилам ниже

ФОРМАТ 6 — Спецификация как источник материалов (SPECIFICATION_AS_MATERIALS):
Колонки: "№ п/п" или "Поз.", "Наименование", "Ед. изм.", "Кол-во"/"Количество"
- position = номер позиции (включая вложенные: 1.1, 1.2, 3.1)
- name = наименование материала КАК ЕСТЬ (не переименовывать)
- unit = единица измерения КАК ЕСТЬ (м², м³, шт, кг, пог.м, т и т.д.)
- quantity = количество
- type_mark = ГОСТ/ТУ/СТО если указан, иначе null
- mass_per_unit = null (обычно отсутствует в спецификациях)

═══════════════════════════════════════════════
ЭТАП 5 — ПРАВИЛА ФОРМИРОВАНИЯ НАИМЕНОВАНИЙ
═══════════════════════════════════════════════

⚠️ В режиме SPECIFICATION_AS_MATERIALS — НЕ переименовывать! Использовать наименование КАК ЕСТЬ из документа.

СОКРАЩЕНИЯ (для режима металлопроката):
- "Тр." ВСЕГДА означает "Труба"
- "φ", "Ø" = диаметр
- "×" после диаметра = толщина стенки (для труб)
- "δ" = толщина (для проката/полосы)

1. АРМАТУРА (содержит "A240", "A400", "A500", "Ø" без "×", или "анкера из арматуры"):
   name = "Изделия из арматуры {Класс} Ø{Диаметр}"
   Примеры: "Изделия из арматуры A240 Ø8", "Изделия из арматуры A400 Ø12"
   type_mark = ГОСТ арматуры (например "ГОСТ 34028-2016") + марка стали если указана (например "25Г2С")
   ⚠️ Для A240 обычно ГОСТ 34028-2016, сталь Ст3сп/Ст3пс
   ⚠️ Для A400/A500 обычно ГОСТ 34028-2016, сталь 25Г2С или 35ГС

2. ТРУБЫ (содержит "Тр.", "Труба", или "Ø{число}×{число}"):
   name = "Труба Ø{Диаметр}×{Толщина} {Марка стали}"
   Примеры: "Труба Ø32×3.2 С235", "Труба Ø820×8 С235"
   type_mark = ГОСТ трубы (например "ГОСТ 10704-91" или "ГОСТ 3262-75") + марка стали
   ⚠️ Электросварные трубы → ГОСТ 10704-91
   ⚠️ ВГП трубы → ГОСТ 3262-75

3. ПРОКАТ / ПОЛОСА (содержит "Прокат", "Полоса", "δ", размеры "80×4"):
   name = "Прокат полоса {Ширина}×{Толщина} {Марка стали}"
   Примеры: "Прокат полоса 80×4 С235"
   type_mark = ГОСТ (например "ГОСТ 103-2006") + марка стали

═══════════════════════════════════════════════
ЭТАП 6 — ПРИВЯЗКА ГОСТ И МАРКИ СТАЛИ
═══════════════════════════════════════════════

⚠️ В режиме SPECIFICATION_AS_MATERIALS: если ГОСТ/ТУ/СТО указан в таблице — используй его. 
Если НЕ указан — оставь type_mark = null. НЕ подставляй стандартные ГОСТы для неметаллических материалов.

Для металлопроката (режим без SPECIFICATION_AS_MATERIALS):

Для КАЖДОГО извлечённого материала ты ОБЯЗАН найти его ГОСТ и марку стали.
Поиск должен охватывать ВЕСЬ документ — не только таблицу, в которой найден материал.

АЛГОРИТМ ПОИСКА (выполняй для каждого материала):

1. Ищи ГОСТ ВНУТРИ таблицы:
   - в колонке "ГОСТ" / "Обозначение" / "Тип, марка"
   - в заголовке группы/секции таблицы (например: "Арматура класса A400 по ГОСТ 34028-2016")
   - в строке с параметрами материала

2. Если НЕ нашёл в таблице — ищи ВНЕ таблицы:
   - в примечаниях под таблицей ("Примечание:", "Прим.:")
   - в текстовых блоках рядом с таблицей
   - в штампе чертежа (нижний правый угол)
   - в заголовке/титуле документа
   - в общих указаниях ("Общие указания", "Материалы")
   - в любом текстовом абзаце на ЛЮБОЙ странице документа

3. Если точный ГОСТ НЕ найден нигде в документе — используй стандартный по типу:
   - Арматура A240 → "ГОСТ 34028-2016 Ст3сп"
   - Арматура A400 → "ГОСТ 34028-2016 25Г2С"
   - Арматура A500 → "ГОСТ 34028-2016 25Г2С"
   - Труба электросварная (Ø > 57мм) → "ГОСТ 10704-91"
   - Труба ВГП (Ø ≤ 50мм) → "ГОСТ 3262-75"
   - Полоса → "ГОСТ 103-2006"
   - Швеллер → "ГОСТ 8240-97"
   - Уголок равнополочный → "ГОСТ 8509-93"
   - Уголок неравнополочный → "ГОСТ 8510-86"
   - Лист → "ГОСТ 19903-2015"
   - Круг → "ГОСТ 2590-2006"

4. Марка стали:
   - Ищи рядом с ГОСТом: "сталь 25Г2С", "Ст3сп", "С235", "С245", "09Г2С"
   - Ищи в примечаниях: "Сталь — С235 по ГОСТ 27772"
   - Ищи в общих указаниях документа
   - Если в документе есть марка стали — ОБЯЗАТЕЛЬНО добавь её

5. Формат type_mark:
   - "{ГОСТ} {марка стали}" — например: "ГОСТ 34028-2016 25Г2С"
   - Если ГОСТ найден, но марка стали нет: "ГОСТ 34028-2016"
   - В режиме металлопроката НИКОГДА не оставляй type_mark пустым

6. Если ГОСТ указан в шапке таблицы для группы — применяй ко ВСЕМ материалам этой группы
7. Если в документе несколько ГОСТов для разных материалов — привязывай КАЖДЫЙ к СВОЕМУ

═══════════════════════════════════════════════
ОБЩИЕ ПРАВИЛА
═══════════════════════════════════════════════

- Каждая ячейка/строка с числом > 0 = ОТДЕЛЬНАЯ позиция материала
- НЕ используй название строки (Водосброс, Плита и т.п.) как наименование — это НЕ материал (кроме режима SPECIFICATION_AS_MATERIALS)
- unit = "кг" для арматуры/труб/проката (в режиме металлопроката)
- ПОЛНОСТЬЮ ИГНОРИРУЙ строки и колонки "Итого", "Всего", любые суммарные
- Если одинаковый материал встречается в нескольких строках — ОТДЕЛЬНАЯ позиция для каждой
- Если в таблице несколько ГОСТов — привязывай КАЖДЫЙ материал к СВОЕМУ ГОСТу по контексту колонки/группы
- Колонку "Марка" (ОГ1, М1 и т.п.) НЕ использовать как материал
- ИГНОРИРУЙ чертежи, схемы, размеры на рисунках
- Если единицы м²/м³/пог.м без признаков металла — в режиме металлопроката это работы, ИГНОРИРУЙ. В режиме SPECIFICATION_AS_MATERIALS — извлекай.

Гибкое сопоставление заголовков:
- "Наименование" / "Наименование и техническая характеристика" → name
- "Тип" / "Тип, марка" / "Обозначение" → type_mark
- "Ед. изм." / "Единица измерения" → unit
- "Кол-во" / "Количество" → quantity
- "Масса ед." / "Масса единицы" → mass_per_unit
- "Сечение" → определяй name по правилам выше
- "Масса всего" → quantity (в кг)

Верни результат СТРОГО в формате JSON массива:
[
  {
    "position": 1,
    "name": "Полное наименование материала",
    "type_mark": "ГОСТ XXXXX-XXXX марка_стали",
    "unit": "кг",
    "quantity": 10,
    "mass_per_unit": 0.5
  }
]

Если quantity или mass_per_unit отсутствуют, ставь null.
КРИТИЧЕСКИ ВАЖНО: Все числа ОБЯЗАТЕЛЬНО записывай через ТОЧКУ (например 2.03, а НЕ 2,03).
В режиме металлопроката: type_mark НИКОГДА не должен быть null или пустым — всегда указывай ГОСТ.
В режиме SPECIFICATION_AS_MATERIALS: type_mark может быть null если ГОСТ/ТУ не указан в документе.
Не добавляй никакого текста кроме JSON массива. Не оборачивай в markdown.`;

    const recognizeChunk = async (
      chunkBytes: Uint8Array,
      chunkIndex: number,
      totalChunks: number,
      docType: string,
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
                { type: "text", text: prompt(docType) },
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
        const preview = normalizedContent.substring(0, 500);
        const noStructuredData = !normalizedContent.includes("[");

        if (noStructuredData) {
          console.warn("Chunk returned no material rows", {
            chunkIndex,
            totalChunks,
            finishReason,
            preview,
          });
          return [];
        }

        console.error("Failed to parse AI response", {
          chunkIndex,
          totalChunks,
          finishReason,
          preview,
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

    // Step 1: Classify document type using first chunk
    console.log("[recognize] Starting document type classification...");
    const { type: detectedSourceType, scores: typeScores } = await classifyDocumentType(pdfChunks[0]);
    console.log(`[recognize] Detected source type: ${detectedSourceType}`, typeScores);

    // For GL documents with no material tables, we may get empty results — that's expected
    const rawRows: any[] = [];
    for (let i = 0; i < pdfChunks.length; i++) {
      const chunkRows = await recognizeChunk(pdfChunks[i], i + 1, pdfChunks.length, detectedSourceType);
      rawRows.push(...chunkRows);
    }

    // ═══════════════════════════════════════════════
    // DEDUPLICATION: prevent double-counting from MASTER + DETAILS tables
    // ═══════════════════════════════════════════════
    const deduplicateMasterDetails = (rows: any[]): any[] => {
      if (rows.length <= 1) return rows;

      // Build structural key for grouping
      const getStructuralKey = (row: any): string | null => {
        const name = String(row?.name || "").toLowerCase();
        // Арматура: extract class + diameter
        const rebarMatch = name.match(/арматур[аыи]?\s+([aа][-]?\d{3,4}[сc]?)\s+[øø]?\s*(\d+)/i);
        if (rebarMatch) {
          const cls = rebarMatch[1].replace(/[аА]/g, "A").replace(/[сС]/g, "C").toUpperCase();
          return `rebar|${cls}|${rebarMatch[2]}`;
        }
        // Труба: extract diameter x thickness
        const pipeMatch = name.match(/труб[аыи]?\s+[øø]?\s*(\d+(?:\.\d+)?)\s*[×x×х]\s*(\d+(?:\.\d+)?)/i);
        if (pipeMatch) return `pipe|${pipeMatch[1]}|${pipeMatch[2]}`;
        // Прокат: extract dimensions
        const steelMatch = name.match(/прокат.*?(\d+(?:\.\d+)?)\s*[×x×х]\s*(\d+(?:\.\d+)?)/i);
        if (steelMatch) return `steel|${steelMatch[1]}|${steelMatch[2]}`;
        return null;
      };

      // Group by structural key
      const groups = new Map<string, any[]>();
      const ungrouped: any[] = [];
      for (const row of rows) {
        const key = getStructuralKey(row);
        if (key) {
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(row);
        } else {
          ungrouped.push(row);
        }
      }

      const deduplicated: any[] = [...ungrouped];

      for (const [key, group] of groups) {
        if (group.length <= 1) {
          deduplicated.push(...group);
          continue;
        }

        // Sort by quantity descending — the largest is likely the MASTER value
        const withQty = group
          .map(r => ({ row: r, qty: typeof r.quantity === "number" ? r.quantity : 0 }))
          .sort((a, b) => b.qty - a.qty);

        const maxQty = withQty[0].qty;
        const sumOfRest = withQty.slice(1).reduce((s, r) => s + r.qty, 0);

        // If the max quantity is close to sum of the rest (within 15% or equal),
        // it means MASTER = sum(DETAILS) → keep only MASTER
        if (maxQty > 0 && sumOfRest > 0) {
          const ratio = Math.abs(maxQty - sumOfRest) / maxQty;
          if (ratio < 0.15) {
            console.log(`[Dedup] ${key}: MASTER ${maxQty} ≈ sum(DETAILS) ${sumOfRest} — keeping MASTER only`);
            deduplicated.push(withQty[0].row);
            continue;
          }
          // If max > sum of rest significantly, could be MASTER + some DETAILS
          // Keep only MASTER if it's the dominant entry (>60% of total)
          const totalQty = maxQty + sumOfRest;
          if (maxQty / totalQty > 0.6) {
            console.log(`[Dedup] ${key}: MASTER ${maxQty} dominates total ${totalQty} — keeping MASTER only`);
            deduplicated.push(withQty[0].row);
            continue;
          }
        }

        // No clear MASTER/DETAILS pattern — keep all entries
        deduplicated.push(...group);
      }

      console.log(`[Dedup] Input: ${rows.length} rows, Output: ${deduplicated.length} rows, Removed: ${rows.length - deduplicated.length}`);
      return deduplicated;
    };

    // Apply deduplication for ALL PDFs — cross-table duplication can happen even in single chunk
    const deduplicatedRows = deduplicateMasterDetails(rawRows);

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

    const normalizedRows: ParsedRow[] = deduplicatedRows
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
      detectedSourceType,
      typeScores,
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

    // Mark statement as recognized + save detected source type
    await supabase
      .from("material_statements")
      .update({ is_recognized: true, detected_source_type: detectedSourceType })
      .eq("id", statementId);

    return new Response(
      JSON.stringify({
        success: true,
        count: materials.length,
        materials,
        warnings,
        missingPositions,
        detectedSourceType,
        typeScores,
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
