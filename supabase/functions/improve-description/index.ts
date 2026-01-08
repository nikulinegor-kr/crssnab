import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();
    
    if (!description || description.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Описание слишком короткое" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Ты помощник для составления описаний заявок на закупку ТМЦ (товарно-материальных ценностей).
Твоя задача - переформулировать описание заявки, сделав его:
- Более информативным и понятным
- Структурированным (если есть несколько позиций)
- С указанием ключевых характеристик (размеры, количество, марка если указана)
- Кратким, но полным

Правила:
- Сохраняй все технические детали из оригинала
- Не добавляй информацию, которой нет в оригинале
- Используй профессиональную лексику
- Ответ должен быть только улучшенным описанием, без пояснений
- Максимум 200 символов`
          },
          {
            role: "user",
            content: `Улучши это описание заявки: "${description}"`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Требуется пополнение баланса AI" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Ошибка AI сервиса");
    }

    const data = await response.json();
    const improvedDescription = data.choices?.[0]?.message?.content?.trim();

    if (!improvedDescription) {
      throw new Error("Пустой ответ от AI");
    }

    return new Response(
      JSON.stringify({ improved: improvedDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("improve-description error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Неизвестная ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
