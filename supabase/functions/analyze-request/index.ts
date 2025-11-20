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
    const { description, organizationId } = await req.json();
    
    if (!description || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Description and organizationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Получаем доступные статусы и приоритеты для организации
    const { data: statuses } = await supabaseClient
      .from('request_statuses')
      .select('name')
      .eq('organization_id', organizationId);

    const { data: priorities } = await supabaseClient
      .from('request_priorities')
      .select('name')
      .eq('organization_id', organizationId);

    const { data: participants } = await supabaseClient
      .from('request_participants')
      .select('name, participant_type')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    const executors = participants?.filter(p => p.participant_type === 'executor').map(p => p.name) || [];
    const statusList = statuses?.map(s => s.name) || ['Новая заявка', 'В работе', 'Доставлено'];
    const priorityList = priorities?.map(p => p.name) || ['Планово', 'Срочно', 'Аварийно'];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Ты - AI помощник для анализа заявок. 
Твоя задача: проанализировать описание заявки и предложить:
1. Подходящий статус из доступных: ${statusList.join(', ')}
2. Приоритет из доступных: ${priorityList.join(', ')}
3. Рекомендованного исполнителя из списка: ${executors.join(', ')}
4. Категорию заявки (например: закупка, ремонт, логистика, аварийная ситуация)
5. Краткое обоснование твоих рекомендаций

Анализируй на основе срочности, типа работ и сложности.`;

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
          { role: 'user', content: `Проанализируй заявку: ${description}` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_request',
              description: 'Анализирует заявку и возвращает рекомендации',
              parameters: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    description: 'Рекомендованный статус заявки',
                    enum: statusList
                  },
                  priority: {
                    type: 'string',
                    description: 'Рекомендованный приоритет',
                    enum: priorityList
                  },
                  executor: {
                    type: 'string',
                    description: 'Рекомендованный исполнитель',
                    enum: executors.length > 0 ? executors : ['Не назначен']
                  },
                  category: {
                    type: 'string',
                    description: 'Категория заявки'
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Краткое обоснование рекомендаций'
                  }
                },
                required: ['status', 'priority', 'category', 'reasoning'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_request' } }
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
          JSON.stringify({ error: 'Требуется пополнение баланса Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-request function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});