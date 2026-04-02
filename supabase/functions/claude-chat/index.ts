import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const systemPrompt = `Ты — AI-ассистент для CRM-системы управления заявками, поставками и закупками (CRSS).

Твои возможности:
- Помогать менеджерам с управлением заявками: приоритизация, назначение, контроль сроков
- Давать рекомендации по оптимизации процессов закупок и поставок
- Помогать анализировать данные: статусы заявок, просроченные поставки, загрузку исполнителей
- Помогать составлять описания для заявок, комментарии, деловые письма поставщикам
- Отвечать на вопросы по логистике, закупкам, складскому учёту
- Давать советы по работе с подрядчиками и поставщиками
- Помогать с планированием бюджетов и контролем расходов

Правила:
- Отвечай на русском языке
- Будь профессиональным, но дружелюбным
- Давай конкретные, практичные рекомендации
- Используй структурированные ответы (списки, таблицы) когда это уместно
- Если не знаешь точный ответ — честно скажи и предложи альтернативу
- При ответах на вопросы о данных — напоминай что у тебя нет прямого доступа к базе данных системы`;

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Превышен лимит запросов к Claude. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Неверный API-ключ Anthropic." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Ошибка AI сервиса" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Anthropic SSE stream to OpenAI-compatible format for the frontend
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                // Convert to OpenAI-compatible SSE format
                const openAIChunk = {
                  choices: [{
                    delta: { content: parsed.delta.text },
                    index: 0,
                  }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
              } else if (parsed.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      },
    });

    const transformed = response.body!.pipeThrough(transformStream);

    return new Response(transformed, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Claude chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Неизвестная ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
