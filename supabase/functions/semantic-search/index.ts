import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, organizationId } = await req.json();
    
    if (!query || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Query and organizationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Получаем все заявки организации
    const { data: requests, error: requestsError } = await supabaseClient
      .from('requests')
      .select('id, request_number, description, status, priority, applicant, executor, contractor, comments, created_at')
      .eq('organization_id', organizationId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(500);

    if (requestsError) throw requestsError;

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Формируем список заявок для анализа
    const requestsList = requests.map((r, idx) => 
      `[${idx}] №${r.request_number}: ${r.description || ''} | Статус: ${r.status} | Приоритет: ${r.priority || ''} | Заявитель: ${r.applicant || ''} | Исполнитель: ${r.executor || ''} | Подрядчик: ${r.contractor || ''}`
    ).join('\n');

    const systemPrompt = `Ты - система семантического поиска. Тебе дан поисковый запрос и список заявок.
Найди заявки, которые семантически соответствуют запросу (по смыслу, а не только по ключевым словам).
Верни индексы (numbers в квадратных скобках) найденных заявок в порядке релевантности.
Если ничего не найдено, верни пустой массив.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Поисковый запрос: "${query}"\n\nСписок заявок:\n${requestsList}` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_search_results',
              description: 'Возвращает индексы найденных заявок',
              parameters: {
                type: 'object',
                properties: {
                  indices: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Массив индексов найденных заявок в порядке релевантности'
                  }
                },
                required: ['indices'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_search_results' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Требуется пополнение баланса.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { indices } = JSON.parse(toolCall.function.arguments);
    const results = indices
      .filter((idx: number) => idx >= 0 && idx < requests.length)
      .map((idx: number) => requests[idx].id);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in semantic-search function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
