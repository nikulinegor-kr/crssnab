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

Проанализируй этот PDF документ и извлеки таблицу материалов.

Таблица обычно имеет 8 столбцов:
1 — Позиция (ИГНОРИРОВАТЬ)
2 — Наименование и техническая характеристика (ИЗВЛЕЧЬ → поле "name")
3 — Тип, марка, обозначение документа, опросного листа (ИЗВЛЕЧЬ → поле "type_mark")
4 — Код оборудования, изделия, материала (ИГНОРИРОВАТЬ)
5 — Единица измерения (ИЗВЛЕЧЬ → поле "unit")
6 — Количество (ИЗВЛЕЧЬ → поле "quantity")
7 — Масса единицы, кг (ИЗВЛЕЧЬ → поле "mass_per_unit")
8 — Примечания (ИГНОРИРОВАТЬ)

СТОЛБЦЫ 1, 4 И 8 ПОЛНОСТЬЮ ИГНОРИРУЙ. НЕ включай их в результат.

ВАЖНОЕ ПРАВИЛО ОБЪЕДИНЕНИЯ СТРОК:
В ведомостях часто одна позиция занимает 2 или более строк. Если следующая строка имеет ПУСТЫЕ значения в столбцах "Единица измерения" (5) и "Количество" (6), то это ПРОДОЛЖЕНИЕ предыдущей позиции:
- Объедини текст столбца 2 (Наименование) через пробел
- Объедини текст столбца 3 (Тип/марка) через пробел
- Удали строку-продолжение (не создавай отдельную запись)

Пример:
Строка 1: name="Кабель силовой медный", type_mark="ВВГнг-LS", unit="м", quantity=100
Строка 2: name="3x2.5 ГОСТ 31996-2012", type_mark="", unit="", quantity=""
Результат: ОДНА строка с name="Кабель силовой медный 3x2.5 ГОСТ 31996-2012", type_mark="ВВГнг-LS", unit="м", quantity=100

ВАЖНО ПО ОПРЕДЕЛЕНИЮ СТОЛБЦОВ:
Названия столбцов могут немного отличаться в разных документах. Используй гибкое сопоставление:
- "Наименование" или "Наименование и техническая характеристика" → name
- "Тип" или "Тип, марка" или "Обозначение" → type_mark  
- "Ед. изм." или "Единица измерения" → unit
- "Кол-во" или "Количество" → quantity
- "Масса ед." или "Масса единицы" или "Масса единицы, кг" → mass_per_unit

Верни результат СТРОГО в формате JSON массива:
[
  {
    "name": "Полное наименование материала",
    "type_mark": "Тип/марка/обозначение или null",
    "unit": "шт",
    "quantity": 10,
    "mass_per_unit": 0.5
  }
]

Если quantity или mass_per_unit отсутствуют, ставь null.
Числа с запятой (напр. "1,5") преобразуй в число с точкой (1.5).
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

    let materials: any[];
    try {
      materials = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(materials)) {
      materials = [];
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
        quantity: m.quantity != null ? Number(m.quantity) : null,
        mass_per_unit: m.mass_per_unit != null ? Number(m.mass_per_unit) : null,
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
