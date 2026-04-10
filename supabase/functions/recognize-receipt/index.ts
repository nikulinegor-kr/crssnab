import { corsHeaders } from "@supabase/supabase-js/cors";

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "ГСМ", keywords: ["азс", "бензин", "газпром", "лукойл", "роснефть", "топливо", "дизель", "газ", "нефтепродукт", "заправк", "shell", "bp ", "татнефть", "сургутнефтегаз"] },
  { category: "Интернет", keywords: ["интернет", "провайдер", "связь", "телеком", "мтс", "билайн", "мегафон", "ростелеком", "теле2", "yota", "wifi", "wi-fi"] },
  { category: "Доставка", keywords: ["доставка", "курьер", "транспорт", "грузоперевозк", "cdek", "сдэк", "почта", "boxberry", "dpd", "pony express", "деловые линии", "пэк"] },
];

function classifyReceipt(text: string): string {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.category;
    }
  }
  return "Прочее";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileName, fileType } = await req.json();

    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64 = btoa(new Uint8Array(fileBuffer).reduce((d, b) => d + String.fromCharCode(b), ""));

    const isPdf = fileType === "application/pdf" || (fileName || "").toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : (fileType || "image/jpeg");

    const prompt = `Это фото/скан чека или квитанции. Извлеки:
1. Общую сумму (итого к оплате)
2. Дату чека
3. Название магазина/организации

Ответь СТРОГО в JSON формате:
{"amount": 1234.56, "date": "2026-01-15", "name": "АЗС Лукойл №123"}

Если не можешь определить поле, поставь null.
Сумму указывай числом без валюты. Дату в формате YYYY-MM-DD.
Не добавляй текст кроме JSON.`;

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
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI error: ${aiResponse.status} ${errText}`);
      return new Response(JSON.stringify({ error: "AI recognition failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result = { amount: null as number | null, date: null as string | null, name: null as string | null };
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    // Classify based on name
    const category = classifyReceipt(result.name || fileName || "");

    return new Response(
      JSON.stringify({
        success: true,
        amount: result.amount,
        date: result.date,
        name: result.name,
        category,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("recognize-receipt error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
