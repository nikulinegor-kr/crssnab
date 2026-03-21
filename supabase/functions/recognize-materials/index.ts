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

    // ═══════════════════════════════════════════════
    // PDF DOWNLOAD & SPLIT
    // ═══════════════════════════════════════════════
    const downloadPdfWithCap = async (url: string, maxBytes: number): Promise<Uint8Array> => {
      let headSize: number | null = null;
      try {
        const headResponse = await fetch(url, { method: "HEAD" });
        if (headResponse.ok) {
          const header = headResponse.headers.get("content-length");
          headSize = header ? Number(header) : null;
        }
      } catch { /* Some hosts block HEAD */ }

      if (headSize !== null && Number.isFinite(headSize) && headSize > maxBytes) {
        throw new Error(sourceTooLargeError);
      }

      const pdfResponse = await fetch(url);
      if (!pdfResponse.ok || !pdfResponse.body) throw new Error("Failed to download PDF");

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
          if (offset > maxBytes) { await reader.cancel(); throw new Error(sourceTooLargeError); }
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
        if (totalBytes > maxBytes) { await reader.cancel(); throw new Error(sourceTooLargeError); }
        chunks.push(value);
      }
      const pdfBytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) { pdfBytes.set(chunk, offset); offset += chunk.length; }
      return pdfBytes;
    };

    const splitPdfForAi = async (pdfBytes: Uint8Array): Promise<Uint8Array[]> => {
      if (pdfBytes.byteLength <= AI_HARD_CHUNK_BYTES) return [pdfBytes];

      const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const totalPages = sourceDoc.getPageCount();
      if (totalPages <= 1) throw new Error("PDF содержит слишком тяжёлую страницу. Сожмите файл.");

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
          throw new Error("Не удалось безопасно разбить PDF. Сожмите файл.");
        }
        chunks.push(selectedBytes);
        pageCursor += selectedPageCount;
      }
      return chunks;
    };

    // ═══════════════════════════════════════════════
    // JSON PARSING HELPERS
    // ═══════════════════════════════════════════════
    const parseRowsWithRecovery = (text: string): any[] | null => {
      const start = text.indexOf("[");
      if (start === -1) return null;
      const fromArray = text.slice(start);
      const lastBracket = fromArray.lastIndexOf("]");
      if (lastBracket > 0) {
        const fullCandidate = fromArray.slice(0, lastBracket + 1);
        try { const parsed = JSON.parse(fullCandidate); return Array.isArray(parsed) ? parsed : null; } catch { /* recovery */ }
      }
      let inString = false, escaped = false, objectDepth = 0;
      const completeObjectEndIndices: number[] = [];
      for (let i = 0; i < fromArray.length; i++) {
        const ch = fromArray[i];
        if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
        if (ch === '"') { inString = true; continue; }
        if (ch === "{") objectDepth++;
        else if (ch === "}" && objectDepth > 0) { objectDepth--; if (objectDepth === 0) completeObjectEndIndices.push(i); }
      }
      for (let idx = completeObjectEndIndices.length - 1; idx >= 0; idx--) {
        const end = completeObjectEndIndices[idx];
        const candidate = `${fromArray.slice(0, end + 1).replace(/,\s*$/, "")}]`;
        try { const parsed = JSON.parse(candidate); return Array.isArray(parsed) ? parsed : null; } catch { /* earlier */ }
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
    // DOCUMENT TYPE CLASSIFICATION
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: [
              { type: "text", text: classifyPrompt },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
            ]}],
            temperature: 0.1, max_tokens: 500,
          }),
        });
        if (!aiResponse.ok) { console.error("[classify] AI failed:", await aiResponse.text()); return { type: "RC", scores: {} }; }
        const aiData = await aiResponse.json();
        let content = (aiData.choices?.[0]?.message?.content || "{}").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const result = JSON.parse(content);
        const validTypes = ["RC", "GL", "MR", "SPEC"];
        const detectedType = validTypes.includes(result.type) ? result.type : "RC";
        console.log(`[classify] Document type: ${detectedType}`, result.scores);
        return { type: detectedType, scores: result.scores || {} };
      } catch (err) {
        console.error("[classify] Error:", err);
        return { type: "RC", scores: {} };
      }
    };

    // ═══════════════════════════════════════════════
    // TYPE-SPECIFIC INSTRUCTIONS
    // ═══════════════════════════════════════════════
    const buildPromptForType = (docType: string): string => {
      const typeSpecific: Record<string, string> = {
        GL: `⚠️ ТИП: ГЕНПЛАН. Извлекай ТОЛЬКО явные материалы из таблиц. Если только чертежи — верни [].`,
        SPEC: `⚠️ ТИП: СПЕЦИФИКАЦИЯ. Извлекай ВСЕ материалы. Разделы "Озеленение", "Покрытия" — это группировка, НЕ работы. Вложенные позиции (1.1, 1.2) — отдельные материалы.`,
        MR: `⚠️ ТИП: ВЕДОМОСТЬ МАТЕРИАЛОВ. Извлекай материалы из КАЖДОЙ строки. Строки с "Конструкция", "Тип 1/2/3" → GROUP (пропустить). Но если строка содержит материал внутри → ИЗВЛЕЧЬ материал.`,
        RC: `⚠️ ТИП: КОНСТРУКЦИИ (RC).
ДВУХЭТАПНОЕ ИЗВЛЕЧЕНИЕ:
ЭТАП A — МЕТАЛЛ: Найди "Ведомость расхода стали" (MASTER, не DETAILS). Извлеки арматуру, трубы, прокат.
ЭТАП B — ВСЕ ПРОЧИЕ МАТЕРИАЛЫ: Просканируй ВЕСЬ документ на другие таблицы ("Спецификация", "Ведомость материалов"). Извлеки бетон, щебень, песок, геотекстиль, геомат, мембрану, XPS и т.д.
НЕ ограничивайся только сталью — нужны ВСЕ материалы документа.
Если строка описывает работу но содержит материал — извлеки МАТЕРИАЛ.`,
      };

      return typeSpecific[docType] || typeSpecific.RC;
    };

    // ═══════════════════════════════════════════════
    // MAIN PROMPT — v3: извлечение материалов из любых строк
    // ═══════════════════════════════════════════════
    const prompt = (docType: string) => `Ты — инженер ПТО. Задача: извлечь ЕДИНУЮ ведомость материалов для ЗАКУПКИ из строительного PDF.

${buildPromptForType(docType)}

═══════════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО: ОДИН МАТЕРИАЛ = ОДИН JSON-ОБЪЕКТ
═══════════════════════════════════════════════

⚠️ АБСОЛЮТНО ЗАПРЕЩЕНО объединять несколько материалов в одну строку!
Каждый физический материал ОБЯЗАН быть отдельным JSON-объектом.

НЕПРАВИЛЬНО (ВСЁ в одной строке):
[{"position": 1, "name": "Арматура A500C Ø14 Щебень гидротехнический Бетон тяжелый Песок Георешетка", ...}]

ПРАВИЛЬНО (каждый материал отдельно):
[
  {"position": 1, "name": "Изделия из арматуры A500C Ø14", "unit": "кг", "quantity": 100},
  {"position": 2, "name": "Щебень гидротехнический из изверженных пород марки не ниже 900", "unit": "м³", "quantity": 50},
  {"position": 3, "name": "Бетон тяжёлый", "unit": "м³", "quantity": 30},
  {"position": 4, "name": "Песок", "unit": "м³", "quantity": 20},
  {"position": 5, "name": "Георешетка ГСД 50/50", "unit": "м²", "quantity": 100}
]

═══════════════════════════════════════════════
ГЛАВНОЕ ПРАВИЛО: ИЗВЛЕКАТЬ МАТЕРИАЛЫ, А НЕ СТРОКИ
═══════════════════════════════════════════════

⚠️ КРИТИЧЕСКИ ВАЖНО:
Материалы извлекаются НЕ по типу строки, а ПО НАЛИЧИЮ МАТЕРИАЛА ВНУТРИ строки.
Строка-работа может СОДЕРЖАТЬ материал → материал ОБЯЗАТЕЛЬНО извлечь.

WORK ≠ ИГНОРИРОВАТЬ. WORK = ИСТОЧНИК МАТЕРИАЛОВ.

Если в таблице ОДНА ЯЧЕЙКА содержит перечисление нескольких материалов
(через запятую, перенос строки, или просто подряд) — РАЗБЕЙ их на отдельные JSON-объекты.

═══════════════════════════════════════════════
АЛГОРИТМ ДЛЯ КАЖДОЙ СТРОКИ
═══════════════════════════════════════════════

ШАГ 1: Прочитай строку целиком.

ШАГ 2: Есть ли внутри ФИЗИЧЕСКИЙ МАТЕРИАЛ, который можно купить?
Список ядровых материалов:
щебень, песок, ПГС, бетон, асфальтобетон, геотекстиль, геомат, геосетка,
грунт (привозной), трубы, арматура, XPS, пенополистирол, эмульсия, битум,
мастика, мембрана, плитка, кирпич, цемент, раствор, кабель, профиль,
сетка, утеплитель, гидроизоляция, рубероид, краска, грунтовка, пена,
лоток, бордюр, поребрик, георешетка, полотно бетонное, мат противоэрозионный,
габионные конструкции, изделия строительные металлические

ШАГ 3: РЕШЕНИЕ
- Если материал НАЙДЕН → ИЗВЛЕЧЬ его как ОТДЕЛЬНЫЙ JSON-объект
- Если материала НЕТ (чистое действие) → ПРОПУСТИТЬ
- Если в строке НЕСКОЛЬКО материалов → создать ОТДЕЛЬНЫЙ JSON-объект для КАЖДОГО

═══════════════════════════════════════════════
ПРИМЕРЫ (ОБЯЗАТЕЛЬНО СЛЕДОВАТЬ)
═══════════════════════════════════════════════

"Устройство основания из щебня фр. 40-80 мм"
→ Строка = WORK, НО содержит МАТЕРИАЛ
→ ИЗВЛЕЧЬ: name="Щебень фр. 40-80 мм", unit="м³", quantity=...

"Устройство покрытия из асфальтобетона мелкозернистого тип А марка I на битуме БНД 90/130"
→ ИЗВЛЕЧЬ: name="Асфальтобетон мелкозернистый тип А марка I на битуме БНД 90/130"

"Устройство подстилающего слоя из песка"
→ ИЗВЛЕЧЬ: name="Песок"

"Устройство армирования геосеткой 50/50"
→ ИЗВЛЕЧЬ: name="Геосетка 50/50"

"Укладка геотекстиля плотностью 300 г/м²"
→ ИЗВЛЕЧЬ: name="Геотекстиль плотностью 300 г/м²"

"Устройство теплоизоляции из XPS 50мм"
→ ИЗВЛЕЧЬ: name="XPS 50мм"

"Устройство гидроизоляции из мембраны ПВХ"
→ ИЗВЛЕЧЬ: name="Мембрана ПВХ"

"Планировка откосов"
→ НЕТ материала → ПРОПУСТИТЬ ✅

"Обратная засыпка"
→ НЕТ материала (засыпка = действие) → ПРОПУСТИТЬ ✅

"Разработка грунта"
→ НЕТ покупного материала → ПРОПУСТИТЬ ✅

"Конструкция автодороги"
→ GROUP/заголовок → ПРОПУСТИТЬ ✅

═══════════════════════════════════════════════
ЕСЛИ В ЯЧЕЙКЕ НЕСКОЛЬКО МАТЕРИАЛОВ — ПРИМЕР
═══════════════════════════════════════════════

Если в одной ячейке таблицы написано:
"Арматура A500C Ø14 Щебень фр. 20-40 Бетон B25 Песок Георешетка 50/50"

→ ОБЯЗАТЕЛЬНО разбить на 5 отдельных JSON-объектов:
1. "Изделия из арматуры A500C Ø14"
2. "Щебень фр. 20-40"
3. "Бетон B25"
4. "Песок"
5. "Георешетка 50/50"

ЗАПРЕЩЕНО возвращать это одной строкой!

═══════════════════════════════════════════════
ПАТТЕРНЫ ИЗВЛЕЧЕНИЯ МАТЕРИАЛА ИЗ СТРОКИ
═══════════════════════════════════════════════

Ищи конструкции:
- "из [МАТЕРИАЛ]" → извлечь МАТЕРИАЛ с параметрами
- "[МАТЕРИАЛ] фр." → извлечь с фракцией
- "[МАТЕРИАЛ] ГОСТ" → извлечь с ГОСТом
- "[МАТЕРИАЛ] тип/марка/класс" → извлечь с параметрами
- "армирование [МАТЕРИАЛ]" → извлечь МАТЕРИАЛ
- "[МАТЕРИАЛ] плотностью" → извлечь с параметром

ВАЖНО: извлекай ТОЛЬКО материал с его параметрами, БЕЗ глаголов/действий.
"Устройство основания из щебня фр. 20-40" → name = "Щебень фр. 20-40", НЕ "Устройство основания из щебня"

═══════════════════════════════════════════════
НОРМАЛИЗАЦИЯ И ДЕДУПЛИКАЦИЯ (КРИТИЧНО!)
═══════════════════════════════════════════════

ОДИН МАТЕРИАЛ = ОДИН КЛЮЧ. Если ключ совпадает — это ОДИН материал, НЕЛЬЗЯ создавать вторую строку.

КЛЮЧИ МАТЕРИАЛОВ:
- Арматура: rebar|{class}|{diameter}
  "Арматура 10 A500C" = "Изделия из арматуры A500C Ø10" = "Ø10 A500C" → rebar|A500C|10
- Труба: pipe|{diameter}|{thickness}
- Бетон: concrete|{class}
  "Бетон В25" = "Бетон класса В25" → concrete|B25
- Щебень: crushed_stone|{fraction}
  "Щебень фр. 20-40" = "Щебень фракции 20-40 мм" → crushed_stone|20-40
- Песок: sand|{type}
- Геотекстиль: geotextile|{density}
- Асфальтобетон: asphalt|{type}|{grade}

ЕСЛИ два материала дают ОДИНАКОВЫЙ ключ:
→ это ОДИН материал → суммировать количество → ЗАПРЕЩЕНО выводить две строки

СТАНДАРТНЫЕ НАИМЕНОВАНИЯ:
- Арматура: "Изделия из арматуры {Класс} Ø{Диаметр}"
- Труба: "Труба Ø{Диаметр}×{Толщина} {Марка}"
- Остальные: наименование материала КАК ЕСТЬ из документа (без глаголов!)

═══════════════════════════════════════════════
АНАЛИЗ СТРУКТУРЫ ДОКУМЕНТА
═══════════════════════════════════════════════

Просканируй ВЕСЬ документ. Определи роли таблиц:

🟢 MASTER — итоговая ведомость (содержит "Всего", агрегированные значения)
→ Если есть MASTER — извлекай ТОЛЬКО из неё, DETAILS игнорируй

🟡 DETAILS — детализация элементов (УМ1, УМ2...)
→ Используй ТОЛЬКО если нет MASTER

🟣 SPECIFICATION_AS_MATERIALS — если нет ни "Ведомости материалов", ни "Ведомости стали", но есть "Спецификация"
→ Спецификация = основной источник

🔴 IGNORE — чертежи, схемы, строки "Итого"/"Всего"

═══════════════════════════════════════════════
ФОРМАТЫ ТАБЛИЦ
═══════════════════════════════════════════════

ФОРМАТ 1 — Ведомость материалов (8 столбцов):
Позиция | Наименование | Тип, марка | Код | Ед. изм. | Количество | Масса ед. | Примечания

ФОРМАТ 2 — Спецификация:
№ п.п. | Наименование | Марка/Обозначение | Масса ед. | Кол-во | Ед. изм.

ФОРМАТ 3 — Сводная матричная (Ведомость расхода стали):
Колонки = параметры (класс, диаметр), строки = элементы, ячейки = кг

ФОРМАТ 4 — Любая другая: адаптируйся к заголовкам.

═══════════════════════════════════════════════
ПРАВИЛА НАИМЕНОВАНИЙ
═══════════════════════════════════════════════

- Наименование = ЧИСТЫЙ МАТЕРИАЛ с параметрами (БЕЗ глаголов)
- Переносы строк → объединять через пробел
- "тип", "марка", "класс", "на битуме" — ЧАСТЬ наименования материала
- Единицы (м², м³, т, кг) → в поле unit
- ГОСТ/ТУ/СТО → в поле type_mark
- Если наименование заканчивается на "марки", "типа", "на", "из" → ОШИБКА обрезки, восстанови

═══════════════════════════════════════════════
ПРИВЯЗКА ГОСТ (для металлопроката)
═══════════════════════════════════════════════

1. Ищи ГОСТ внутри таблицы (колонка "ГОСТ"/"Обозначение"/"Тип, марка")
2. Ищи вне таблицы (примечания, штамп, общие указания)
3. Если не нашёл — используй стандартный:
   - Арматура A240/A400/A500 → "ГОСТ 34028-2016"
   - Труба электросварная → "ГОСТ 10704-91"
   - Труба ВГП → "ГОСТ 3262-75"
4. Марку стали (25Г2С, С235, Ст3сп) ищи рядом с ГОСТом
5. type_mark = "{ГОСТ} {марка стали}"

Для неметаллических материалов: type_mark = ГОСТ если указан в документе, иначе null.

═══════════════════════════════════════════════
СПЕЦИАЛЬНЫЕ ПРАВИЛА
═══════════════════════════════════════════════

- "анкера из арматуры" → МАТЕРИАЛ (тип: арматура), извлечь диаметр
- unit = "кг" для арматуры/труб/проката
- ПОЛНОСТЬЮ ИГНОРИРУЙ строки "Итого", "Всего"
- Колонку "Марка" (ОГ1, М1) НЕ использовать как материал

═══════════════════════════════════════════════
ФИНАЛЬНАЯ САМОПРОВЕРКА (обязательна!)
═══════════════════════════════════════════════

Перед выводом результата проверь КАЖДЫЙ элемент:

1. "Это физический материал, который можно купить?" → Если НЕТ → УДАЛИ
2. "Наименование содержит глагол (устройство, разработка)?" → Если ДА → УБЕРИ глагол, оставь только материал
3. "Есть ли дубль с таким же ключом?" → Если ДА → ОБЪЕДИНИ (суммируй quantity)
4. "Наименование полное?" → Если обрезано → ВОССТАНОВИ
5. Если найдено < 3 материалов → добавь warning "Подозрительно мало материалов"
6. Если есть 2 строки с одинаковым типом+классом+диаметром → ОШИБКА, объедини
7. ⚠️ Если в поле "name" содержится БОЛЬШЕ ОДНОГО материала → ОШИБКА, разбей на отдельные объекты

Верни результат СТРОГО в формате JSON массива:
[
  {
    "position": 1,
    "name": "Полное наименование ОДНОГО МАТЕРИАЛА (без глаголов!)",
    "type_mark": "ГОСТ XXXXX-XXXX марка_стали",
    "unit": "кг",
    "quantity": 10,
    "mass_per_unit": 0.5
  }
]

⚠️ КАЖДЫЙ JSON-объект = РОВНО ОДИН МАТЕРИАЛ. Никогда не объединяй несколько материалов в одно поле name!

Все числа через ТОЧКУ (2.03, НЕ 2,03). Не добавляй текст кроме JSON.`;

    // ═══════════════════════════════════════════════
    // RECOGNIZE CHUNK
    // ═══════════════════════════════════════════════
    const recognizeChunk = async (chunkBytes: Uint8Array, chunkIndex: number, totalChunks: number, docType: string): Promise<any[]> => {
      const pdfBase64 = encodeBase64(chunkBytes);
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: prompt(docType) },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ]}],
          temperature: 0.1, max_tokens: 64000,
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
        if (!normalizedContent.includes("[")) {
          console.warn("Chunk returned no material rows", { chunkIndex, totalChunks, finishReason, preview });
          return [];
        }
        console.error("Failed to parse AI response", { chunkIndex, totalChunks, finishReason, preview });
        throw new Error(`Failed to parse AI response on part ${chunkIndex}/${totalChunks}`);
      }

      if (finishReason && finishReason !== "stop") {
        console.warn("AI response may be truncated, recovered partial JSON", { chunkIndex, totalChunks, finishReason, recoveredCount: parsedRows.length });
      }
      return parsedRows;
    };

    // ═══════════════════════════════════════════════
    // EXECUTE: download, classify, recognize
    // ═══════════════════════════════════════════════
    const pdfBytes = await downloadPdfWithCap(fileUrl, MAX_SOURCE_PDF_BYTES);
    const pdfChunks = await splitPdfForAi(pdfBytes);

    console.log("[recognize] Starting document type classification...");
    const { type: detectedSourceType, scores: typeScores } = await classifyDocumentType(pdfChunks[0]);
    console.log(`[recognize] Detected source type: ${detectedSourceType}`, typeScores);

    const rawRows: any[] = [];
    for (let i = 0; i < pdfChunks.length; i++) {
      const chunkRows = await recognizeChunk(pdfChunks[i], i + 1, pdfChunks.length, detectedSourceType);
      rawRows.push(...chunkRows);
    }

    // ═══════════════════════════════════════════════
    // POST-PROCESSING: SPLIT CONCATENATED MATERIALS
    // ═══════════════════════════════════════════════
    const materialBoundaryKeywords = [
      'изделия из арматур', 'изделия строительные', 'полотно бетонное',
      'мат полиамидн', 'мат противоэрозионн', 'щебеночно-песчан',
      'арматур', 'щебень', 'щебен', 'бетон', 'песок', 'геотекстиль', 'геомат',
      'геосетк', 'георешетк', 'труб', 'асфальтобетон', 'мембран',
      'пенополистирол', 'эмульси', 'битум', 'мастик', 'плитк', 'кирпич',
      'цемент', 'раствор', 'кабел', 'профиль', 'утеплител',
      'гидроизоляц', 'рубероид', 'краск', 'грунтовк', 'лоток',
      'бордюр', 'поребрик', 'энкамат', 'габион', 'анкер',
      'нагель', 'блок лотка', 'блок упора', 'бандаж', 'пригрузка',
      'растительный грунт', 'железобетонн', 'полотно',
      'антисептированн', 'доск',
    ];

    // Sort by length DESC so longer keywords match first
    materialBoundaryKeywords.sort((a, b) => b.length - a.length);

    const splitConcatenatedRow = (row: any): any[] => {
      const name = String(row?.name || "").trim();
      if (!name || name.length < 40) return [row];

      const lowerName = name.toLowerCase();

      // Find all material keyword boundaries
      const boundaries: { keyword: string; index: number; length: number }[] = [];
      for (const kw of materialBoundaryKeywords) {
        const kwLower = kw.toLowerCase();
        let searchFrom = 0;
        while (true) {
          const idx = lowerName.indexOf(kwLower, searchFrom);
          if (idx === -1) break;
          // Skip if this position is already covered by a longer keyword
          const alreadyCovered = boundaries.some(b =>
            idx >= b.index && idx < b.index + b.length
          );
          if (!alreadyCovered) {
            boundaries.push({ keyword: kw, index: idx, length: kwLower.length });
          }
          searchFrom = idx + 1;
        }
      }

      if (boundaries.length < 2) return [row];

      // Sort by position
      boundaries.sort((a, b) => a.index - b.index);

      // Deduplicate overlapping boundaries (keep the one that starts earliest, or longest)
      const deduped: typeof boundaries = [];
      for (const b of boundaries) {
        const overlap = deduped.some(d =>
          (b.index >= d.index && b.index < d.index + d.length + 3)
        );
        if (!overlap) deduped.push(b);
      }

      if (deduped.length < 2) return [row];

      // Split at each boundary
      const parts: string[] = [];
      for (let i = 0; i < deduped.length; i++) {
        const start = deduped[i].index;
        const end = i + 1 < deduped.length ? deduped[i + 1].index : name.length;
        let part = name.substring(start, end).trim().replace(/[\s,;]+$/, '').trim();
        if (part.length > 2) parts.push(part);
      }

      // Also capture text before the first keyword if it's meaningful
      if (deduped[0].index > 3) {
        const prefix = name.substring(0, deduped[0].index).trim().replace(/[\s,;]+$/, '').trim();
        if (prefix.length > 3) {
          parts.unshift(prefix);
        }
      }

      if (parts.length <= 1) return [row];

      console.log(`[SplitConcat] "${name.substring(0, 60)}..." → ${parts.length} parts: ${parts.map(p => p.substring(0, 30)).join(' | ')}`);

      return parts.map((part, idx) => ({
        ...row,
        name: part,
        position: null, // will be re-assigned later
        quantity: null, // each split part needs its own quantity from the document
        unit: null,
      }));
    };

    const splitRows: any[] = [];
    for (const row of rawRows) {
      splitRows.push(...splitConcatenatedRow(row));
    }
    console.log(`[SplitConcat] Before: ${rawRows.length}, After: ${splitRows.length}`);

    //
    // ═══════════════════════════════════════════════
    const getStructuralKey = (row: any): string | null => {
      const rawName = String(row?.name || "");
      const name = rawName.toLowerCase().replace(/ё/g, "е");

      // Арматура / Изделия из арматуры
      const isRebar = /(?:арматур|изделия\s+из\s+арматур|анкер[аы]?\s+из\s+арматур)/i.test(name);
      if (isRebar) {
        const classMatch = name.match(/[aа][-]?\d{3,4}[cс]?/i);
        const cls = classMatch
          ? classMatch[0].replace(/[аА]/g, "A").replace(/[сС]/g, "C").toUpperCase()
          : "";
        const diaMatch =
          name.match(/[øøΦφ∅]\s*(\d+)/i) ||
          name.match(/d\s*(\d+)/i) ||
          name.match(/(?:^|[\s])(\d{1,2})(?:\s*[aа][-]?\d{3}|\s*мм)/i);
        const dia = diaMatch ? diaMatch[1] : "";
        if (cls || dia) return `rebar|${cls}|${dia}`;
      }

      // Труба
      const pipeMatch = name.match(/труб[аыие]?\s*[øøΦφ∅]?\s*(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/i);
      if (pipeMatch) return `pipe|${pipeMatch[1].replace(",", ".")}|${pipeMatch[2].replace(",", ".")}`;

      // Прокат / Полоса
      const steelMatch = name.match(/(?:прокат|полоса).*?(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/i);
      if (steelMatch) return `steel|${steelMatch[1].replace(",", ".")}|${steelMatch[2].replace(",", ".")}`;

      // Бетон
      const concreteMatch = name.match(/бетон[а-я]*\s+.*?[вb]\s*(\d+)/i);
      if (concreteMatch) return `concrete|B${concreteMatch[1]}`;

      // Щебень
      const crushedMatch = name.match(/щебен[ьи].*?(?:фр\.?\s*|фракци[яию]\s*)(\d+)\s*[-–]\s*(\d+)/i);
      if (crushedMatch) return `crushed_stone|${crushedMatch[1]}-${crushedMatch[2]}`;

      // Песок
      if (/\bпесо[кч]/i.test(name)) {
        const sandType = name.match(/(крупнозернист|среднезернист|мелкозернист|намывн|карьерн|речн)/i);
        return `sand|${sandType ? sandType[1].toLowerCase().slice(0, 6) : "generic"}`;
      }

      // Геотекстиль
      const geoMatch = name.match(/геотекстил[ьея].*?(\d+)/i);
      if (geoMatch) return `geotextile|${geoMatch[1]}`;

      // Геомат
      if (/геомат/i.test(name)) {
        const geoMatType = name.match(/(\d+)/);
        return `geomat|${geoMatType ? geoMatType[1] : "generic"}`;
      }

      // Асфальтобетон
      if (/асфальтобетон/i.test(name)) {
        const asphaltType = name.match(/(мелкозернист|крупнозернист|песчан)/i);
        const asphaltGrade = name.match(/марк[аи]\s+([IVX]+)/i);
        return `asphalt|${asphaltType ? asphaltType[1].slice(0, 6) : "generic"}|${asphaltGrade ? asphaltGrade[1] : ""}`;
      }

      return null;
    };

    // ═══════════════════════════════════════════════
    // TEXT-BASED NORMALIZATION for non-parametric dedup
    // ═══════════════════════════════════════════════
    const normalizeNameForDedup = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ")
        .replace(/[«»"']/g, "")
        .replace(/\b(гост|ту|сто|ост)\s*[\d.-]+\S*/gi, "")
        .replace(/\b(по|в соответствии с|согласно)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // ═══════════════════════════════════════════════
    // DEDUPLICATION — key-based + text-based
    // ═══════════════════════════════════════════════
    const deduplicateRows = (rows: any[]): any[] => {
      if (rows.length <= 1) return rows;

      const keyGroups = new Map<string, any[]>();
      const ungrouped: any[] = [];

      for (const row of rows) {
        const key = getStructuralKey(row);
        if (key) {
          if (!keyGroups.has(key)) keyGroups.set(key, []);
          keyGroups.get(key)!.push(row);
        } else {
          ungrouped.push(row);
        }
      }

      const deduplicated: any[] = [];

      for (const [key, group] of keyGroups) {
        if (group.length === 1) {
          deduplicated.push(group[0]);
          continue;
        }

        const sorted = group.sort((a: any, b: any) => (String(b.name || "").length - String(a.name || "").length));
        const best = { ...sorted[0] };
        let totalQty = 0;
        let hasQty = false;

        for (const item of group) {
          const qty = typeof item.quantity === "number" ? item.quantity : 0;
          if (typeof item.quantity === "number") hasQty = true;
          totalQty += qty;
          if ((item.type_mark || "").length > (best.type_mark || "").length) {
            best.type_mark = item.type_mark;
          }
        }

        // Check if all quantities are effectively the same (within 2% tolerance for float imprecision)
        const withQtyItems = group.filter((item: any) => typeof item.quantity === "number" && item.quantity > 0);
        const allEffectivelySameQty = withQtyItems.length > 0 && withQtyItems.every((item: any) => {
          const ref = withQtyItems[0].quantity;
          return Math.abs(item.quantity - ref) / Math.max(1, ref) < 0.02;
        });

        if (allEffectivelySameQty) {
          best.quantity = withQtyItems[0].quantity;
          console.log(`[Dedup] ${key}: ${group.length} duplicates with same qty (${withQtyItems[0].quantity}) → keeping one`);
        } else if (withQtyItems.length >= 2) {
          // Different quantities: take the LARGEST as MASTER (not sum)
          const sortedByQty = withQtyItems.sort((a: any, b: any) => b.quantity - a.quantity);
          const maxQty = sortedByQty[0].quantity;
          const secondQty = sortedByQty[1].quantity;
          const sumOfRest = sortedByQty.slice(1).reduce((s: number, r: any) => s + r.quantity, 0);

          // If max ≈ sum of rest → MASTER/DETAILS pattern, take max
          if (Math.abs(maxQty - sumOfRest) / maxQty < 0.15) {
            best.quantity = maxQty;
            console.log(`[Dedup] ${key}: MASTER ${maxQty} ≈ sum(DETAILS) ${sumOfRest} → keeping MASTER`);
          } else if (maxQty >= secondQty * 1.5) {
            // Max clearly dominates → take max (likely MASTER)
            best.quantity = maxQty;
            console.log(`[Dedup] ${key}: MASTER ${maxQty} dominates (2nd: ${secondQty}) → keeping MASTER`);
          } else {
            // Unclear relationship — take max as safest bet (avoid doubling)
            best.quantity = maxQty;
            console.log(`[Dedup] ${key}: ambiguous (${withQtyItems.map((r: any) => r.quantity).join(', ')}) → taking max ${maxQty}`);
          }
        } else {
          best.quantity = hasQty ? totalQty : null;
          console.log(`[Dedup] ${key}: ${group.length} items → total ${totalQty}`);
        }

        deduplicated.push(best);
      }

      // Text-based dedup for ungrouped items
      const textGroups = new Map<string, any[]>();
      for (const row of ungrouped) {
        const normName = normalizeNameForDedup(row.name || "");
        if (!normName) { deduplicated.push(row); continue; }
        const sortedWords = normName.split(" ").filter(Boolean).sort().join(" ");
        if (!textGroups.has(sortedWords)) textGroups.set(sortedWords, []);
        textGroups.get(sortedWords)!.push(row);
      }

      for (const [normKey, group] of textGroups) {
        if (group.length === 1) {
          deduplicated.push(group[0]);
          continue;
        }

        const withQtyItems = group.filter((item: any) => typeof item.quantity === "number" && item.quantity > 0);
        const allEffectivelySameQty = withQtyItems.length > 0 && withQtyItems.every((item: any) => {
          const ref = withQtyItems[0].quantity;
          return Math.abs(item.quantity - ref) / Math.max(1, ref) < 0.02;
        });

        const sorted = group.sort((a: any, b: any) => (String(b.name || "").length - String(a.name || "").length));
        const best = { ...sorted[0] };

        if (allEffectivelySameQty) {
          best.quantity = withQtyItems[0].quantity;
          console.log(`[Dedup-text] "${normKey}": ${group.length} duplicates with same qty → keeping one`);
        } else {
          // Take max quantity instead of summing to avoid doubling
          const maxQty = Math.max(...withQtyItems.map((r: any) => r.quantity), 0);
          best.quantity = maxQty > 0 ? maxQty : group.reduce((s: number, item: any) => s + (typeof item.quantity === "number" ? item.quantity : 0), 0);
          console.log(`[Dedup-text] "${normKey}": ${group.length} items, taking max qty ${best.quantity}`);
        }
        deduplicated.push(best);
      }

      console.log(`[Dedup] Input: ${rows.length}, Output: ${deduplicated.length}, Removed: ${rows.length - deduplicated.length}`);
      return deduplicated;
    };

    const deduplicatedRows = deduplicateRows(splitRows);

    // ═══════════════════════════════════════════════
    // POST-PROCESSING: normalize, group, score
    // ═══════════════════════════════════════════════
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
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
        else s = s.replace(/,/g, "");
      } else if (s.includes(",")) s = s.replace(",", ".");
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const MAX_REASONABLE_POSITION = 500;
    const sanitizePosition = (pos: number | null): number | null => {
      if (pos === null || !Number.isFinite(pos) || pos <= 0 || pos > MAX_REASONABLE_POSITION) return null;
      return pos;
    };

    const parsePosition = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return sanitizePosition(value);
      const s = normalizeText(value).replace(/\u00A0/g, " ");
      if (!s) return null;
      const direct = s.match(/^(\d{1,4}(?:[.,]\d+)?)(?:[.)])?$/);
      if (direct) return sanitizePosition(parseFloat(direct[1].replace(",", ".")));
      const embedded = s.match(/(?:^|\D)(\d{1,4})(?:\D|$)/);
      if (!embedded) return null;
      return sanitizePosition(Number(embedded[1]));
    };

    const extractLeadingPositionFromName = (name: string): { position: number | null; cleanName: string } => {
      const match = name.match(/^(\d{1,4})(?:\s*[.)-])?\s+(.+)$/);
      if (!match) return { position: null, cleanName: name };
      return { position: sanitizePosition(Number(match[1])), cleanName: match[2].trim() };
    };

    type ParsedRow = { position: number | null; name: string; type_mark: string | null; unit: string | null; quantity: number | null; mass_per_unit: number | null };
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
      .filter((row) => row.position !== null || !!row.name || !!row.type_mark || !!row.unit || row.quantity !== null || row.mass_per_unit !== null);

    const mergeText = (left: string | null | undefined, right: string | null | undefined): string =>
      [left || "", right || ""].filter(Boolean).join(" ").trim();

    const mergeIntoGroup = (target: GroupedRow, source: ParsedRow) => {
      target.name = mergeText(target.name, source.name);
      target.type_mark = mergeText(target.type_mark, source.type_mark) || null;
      if (!target.unit && source.unit) target.unit = source.unit;
      if (target.quantity === null && source.quantity !== null) target.quantity = source.quantity;
      if (target.mass_per_unit === null && source.mass_per_unit !== null) target.mass_per_unit = source.mass_per_unit;
    };

    const isStandaloneRow = (row: ParsedRow): boolean => {
      if (!row.name) return false;
      if (row.unit || row.quantity !== null) return true;
      return false;
    };

    const groupedRows: GroupedRow[] = [];
    const leadingRows: ParsedRow[] = [];
    let currentGroup: GroupedRow | null = null;
    let autoPosition = 10000;

    for (const row of normalizedRows) {
      if (row.position !== null) {
        if (currentGroup && row.position === currentGroup.position) { mergeIntoGroup(currentGroup, row); continue; }
        if (currentGroup) groupedRows.push(currentGroup);
        currentGroup = { ...row, position: row.position };
        continue;
      }
      if (isStandaloneRow(row)) {
        if (currentGroup) groupedRows.push(currentGroup);
        autoPosition++;
        currentGroup = { ...row, position: autoPosition };
      } else if (currentGroup) {
        mergeIntoGroup(currentGroup, row);
      } else {
        leadingRows.push({ ...row });
      }
    }
    if (currentGroup) groupedRows.push(currentGroup);

    // Warnings
    const positionSequence = groupedRows.map((row) => row.position);
    const missingPositions: number[] = [];
    const outOfOrderTransitions: Array<{ from: number; to: number }> = [];

    for (let i = 1; i < positionSequence.length; i++) {
      const prev = positionSequence[i - 1];
      const next = positionSequence[i];
      if (next > prev + 1) { for (let p = prev + 1; p < next && missingPositions.length < 5000; p++) missingPositions.push(p); }
      else if (next < prev) outOfOrderTransitions.push({ from: prev, to: next });
    }

    const warnings: string[] = [];
    if (missingPositions.length > 0) {
      const sample = missingPositions.slice(0, 25).join(", ");
      warnings.push(`Обнаружены пропущенные позиции: ${sample}${missingPositions.length > 25 ? ", ..." : ""} (всего: ${missingPositions.length}).`);
    }
    if (outOfOrderTransitions.length > 0) {
      const sample = outOfOrderTransitions.slice(0, 10).map((t) => `${t.from}→${t.to}`).join(", ");
      warnings.push(`Обнаружены непоследовательные переходы позиций: ${sample}.`);
    }
    if (leadingRows.length > 0) {
      warnings.push(`Есть ${leadingRows.length} строк(и) до первой распознанной позиции.`);
    }
    if (groupedRows.length === 0 && normalizedRows.length > 0) {
      warnings.push("Не удалось извлечь номера позиций.");
    }

    const materials = groupedRows.length > 0
      ? [...leadingRows, ...groupedRows.map(({ position, ...row }) => row)]
      : normalizedRows.map(({ position, ...row }) => row);

    // ═══════════════════════════════════════════════
    // CONFIDENCE SCORING — updated for new extraction logic
    // ═══════════════════════════════════════════════
    const truncationSuffixes = /\b(марки|типа|на|из|класса|марке|типу)\s*$/i;
    const workKeywords = /\b(устройство|разработка|планировка|восстановление|уплотнение|нарезка|монтаж|демонтаж|укладка|установка|подготовка|работы|обратная\s+засыпка|окраска|бетонирование|армирование|засыпка|выемка|срезка)\b/i;
    const workStartKeywords = /^\s*(устройство|разработка|планировка|восстановление|уплотнение|нарезка|монтаж|демонтаж|укладка|установка|подготовка|засыпка|обратная\s+засыпка|срезка|выемка|окраска|грунтование|бетонирование|армирование|расчистка|вырубка|корчёвка|снятие|удаление|очистка|прокладка|пробивка|заделка|выравнивание)/i;
    const materialKeywords = /\b(бетон|щебень|арматур|песок|геотекстиль|асфальтобетон|грунт|плит[аы]|кирпич|цемент|раствор|труб[аыие]|кабел|провод|балк[аи]|швеллер|уголок|лист|профиль|сетк[аи]|гвозд|болт|гайк|шайб|анкер|пенопласт|минват|утеплител|гидроизоляц|мембран|рубероид|битум|мастик|краск|грунтовк|эмаль|лак|клей|герметик|пена|саморез|дюбел|хомут|муфт|фланец|задвижк|вентил|кран|насос|радиатор|конвектор|воздуховод|лоток|короб|подрозетник|выключател|розетк|светильник|лампа|автомат|УЗО|контактор|реле|счётчик|счетчик|трансформатор|геомат|геосетк|пенополистирол|XPS|бордюр|поребрик|ПГС)\b/i;
    const paramKeywords = /(\bØ\s*\d|\bd\s*\d|\bфр\.?\s*\d|\bфракци[яи]|\bкласс\s+[A-ZА-Я]|\bмарк[аи]\s+[A-ZА-Я0-9]|\bC\d{2,3}|\bB\d{2,3}|\bM\d{2,3})/i;
    const gostKeywords = /\b(ГОСТ|ТУ|СТО|ОСТ)\s*\d/i;
    const validUnits = /^(т|кг|м|м²|м³|м2|м3|мп|м\.п\.|шт|шт\.|компл|комплект|л|рул|упак|пачк|бухт)$/i;
    const unitMismatchRules: Array<{ material: RegExp; badUnits: RegExp }> = [
      { material: /арматур/i, badUnits: /^(м²|м2|л|рул)$/i },
      { material: /бетон/i, badUnits: /^(т|кг|шт|м|мп)$/i },
      { material: /щебень|песок|грунт/i, badUnits: /^(шт|м|мп|м²|м2)$/i },
    ];

    const calculateConfidence = (row: any): { confidence: number; confidence_level: string } => {
      const name: string = (row.name || "").trim();
      const unit: string = (row.unit || "").trim();
      let score = 50;

      // Bonuses
      if (materialKeywords.test(name)) score += 20;
      if (paramKeywords.test(name) || paramKeywords.test(row.type_mark || "")) score += 15;
      if (gostKeywords.test(name) || gostKeywords.test(row.type_mark || "")) score += 10;
      if (unit && validUnits.test(unit)) score += 10;
      if (getStructuralKey(row)) score += 10;

      // Penalties — now only penalize if name STARTS with a work verb (material not extracted properly)
      if (workStartKeywords.test(name)) score -= 40;
      if (/\bработы\b/i.test(name)) score -= 30;
      if (name.length > 0 && name.length < 20) score -= 25;
      if (truncationSuffixes.test(name)) score -= 20;
      if (workKeywords.test(name) && materialKeywords.test(name)) score -= 10; // reduced: material extracted from work is OK
      const qty = parseLocaleNumber(row.quantity);
      if (!qty || qty <= 0) score -= 15;
      for (const rule of unitMismatchRules) {
        if (rule.material.test(name) && unit && rule.badUnits.test(unit)) { score -= 15; break; }
      }

      const confidence = Math.max(0, Math.min(100, score));
      const confidence_level = confidence >= 70 ? "HIGH" : confidence >= 40 ? "MEDIUM" : "LOW";
      return { confidence, confidence_level };
    };

    for (const m of materials) {
      const name = (m as any).name || "";
      const conf = calculateConfidence(m);
      (m as any).confidence = conf.confidence;
      (m as any).confidence_level = conf.confidence_level;

      if (name.length > 0 && name.length < 20) {
        warnings.push(`Позиция "${name}" — короткое наименование (${name.length} симв.), возможна обрезка.`);
      }
      if (truncationSuffixes.test(name)) {
        warnings.push(`Позиция "${name}" — наименование обрезано.`);
      }
      if (workStartKeywords.test(name)) {
        warnings.push(`Позиция "${name}" — наименование начинается с глагола. Материал не извлечён из описания работы.`);
      }
      if (conf.confidence_level === "LOW") {
        warnings.push(`Позиция "${name}" — низкий confidence (${conf.confidence}%).`);
      }
    }

    // ═══════════════════════════════════════════════
    // QUANTITY VALIDATION — remove items without quantity
    // ═══════════════════════════════════════════════
    const skippedNoQty: string[] = [];

    const validMaterials = materials.filter((m: any) => {
      const qty = parseLocaleNumber(m.quantity);
      if (qty !== null && Number.isFinite(qty) && qty > 0) return true;
      skippedNoQty.push(m.name || "(без названия)");
      return false;
    });

    if (skippedNoQty.length > 0) {
      const sample = skippedNoQty.slice(0, 10).join("; ");
      warnings.push(`Пропущено ${skippedNoQty.length} позиций без количества: ${sample}${skippedNoQty.length > 10 ? "..." : ""}`);
      console.log(`[QtyFilter] Removed ${skippedNoQty.length} items without quantity:`, skippedNoQty);
    }

    if (validMaterials.length > 0 && validMaterials.length < 3) {
      warnings.push(`Подозрительно мало материалов (${validMaterials.length}). Проверьте результат.`);
    }

    // Post-dedup check
    const finalKeyCheck = new Map<string, string>();
    for (const m of validMaterials) {
      const key = getStructuralKey(m);
      if (key) {
        if (finalKeyCheck.has(key)) {
          warnings.push(`Обнаружен дубль: "${(m as any).name}" и "${finalKeyCheck.get(key)}" имеют одинаковый ключ ${key}.`);
        } else {
          finalKeyCheck.set(key, (m as any).name || "");
        }
      }
    }

    console.log("Recognition diagnostics:", JSON.stringify({
      strategy: "unified_v3_extract_from_work",
      detectedSourceType,
      typeScores,
      rawRows: rawRows.length,
      afterSplit: splitRows.length,
      afterDedup: deduplicatedRows.length,
      normalizedRows: normalizedRows.length,
      groupedRows: groupedRows.length,
      leadingRows: leadingRows.length,
      finalRows: validMaterials.length,
      skippedNoQuantity: skippedNoQty.length,
      positionSequenceSample: positionSequence.slice(0, 20),
      warningsCount: warnings.length,
    }));

    // ═══════════════════════════════════════════════
    // SAVE TO DATABASE
    // ═══════════════════════════════════════════════
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("material_statement_items").delete().eq("statement_id", statementId);

    if (validMaterials.length > 0) {
      const items = validMaterials.map((m: any, idx: number) => ({
        statement_id: statementId,
        organization_id: organizationId,
        row_number: idx + 1,
        name: m.name || "",
        type_mark: m.type_mark || null,
        unit: m.unit || null,
        quantity: m.quantity,
        mass_per_unit: m.mass_per_unit,
        confidence: m.confidence ?? null,
        confidence_level: m.confidence_level ?? null,
      }));

      const { error: insertError } = await supabase.from("material_statement_items").insert(items);
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save items", details: insertError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await supabase.from("material_statements")
      .update({ is_recognized: true, detected_source_type: detectedSourceType })
      .eq("id", statementId);

    return new Response(
      JSON.stringify({ success: true, count: validMaterials.length, materials: validMaterials, warnings, missingPositions, detectedSourceType, typeScores }),
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
