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
    const { fileUrl, fileType, textContent } = await req.json();

    if (!fileUrl && !textContent) {
      return new Response(
        JSON.stringify({ error: "fileUrl or textContent required" }),
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

    const prompt = `Ты эксперт по распознаванию коммерческих предложений (КП) от поставщиков строительных материалов.

Проанализируй этот документ и извлеки список товаров/материалов из коммерческого предложения.

Для каждого товара извлеки:
- "name" — наименование товара/материала (полное)
- "unit" — единица измерения (шт, м, кг, м2, м3, т и т.д.)
- "price" — цена за единицу (число)
- "supplier" — название поставщика/компании, если указано в документе (одно на весь КП)

ВАЖНО:
- Извлекай ВСЕ позиции из таблицы.
- Цены должны быть числами (не строками). Используй ТОЧКУ как разделитель десятичных.
- Если единица измерения не указана, ставь null.
- Если цена не указана для позиции, ставь null.
- Поле supplier одинаковое для всех позиций — название компании-поставщика из шапки КП.

Верни результат СТРОГО в формате JSON:
{
  "supplier": "ООО Название поставщика",
  "items": [
    {
      "name": "Наименование материала",
      "unit": "шт",
      "price": 1500.50
    }
  ]
}

Не добавляй никакого текста кроме JSON. Не оборачивай в markdown.`;

    let messages: any[];

    if (textContent) {
      // Excel was parsed client-side, send as text
      messages = [
        {
          role: "user",
          content: `${prompt}\n\nСодержимое файла (таблица):\n\n${textContent}`,
        },
      ];
    } else {
      // PDF — download and send as image
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to download file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileArrayBuffer = await fileResponse.arrayBuffer();
      const fileBase64 = btoa(
        new Uint8Array(fileArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const mimeType = "application/pdf";

      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${fileBase64}` },
            },
          ],
        },
      ];
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
        max_tokens: 32000,
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
    let content = aiData.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Fix locale commas
    const fixLocaleCommas = (text: string): string => {
      return text.replace(/(:\s*-?)(\d+),(\d+)(\s*[,\}\]\s\n\r])/g, '$1$2.$3$4');
    };
    content = fixLocaleCommas(content);
    content = fixLocaleCommas(content);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse KP response:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 1000) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supplier = parsed.supplier || null;
    const items = Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
      name: String(item.name || "").trim(),
      unit: item.unit ? String(item.unit).trim() : null,
      price: typeof item.price === "number" ? item.price : null,
    })).filter((item: any) => item.name) : [];

    return new Response(
      JSON.stringify({ success: true, supplier, items }),
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
