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
    const { type, organizationId, period } = await req.json();
    
    if (!type || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Type and organizationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Получаем заявки за последние 12 месяцев
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: requests, error: requestsError } = await supabaseClient
      .from('requests')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (requestsError) throw requestsError;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    // Подготовка данных для анализа
    const requestsSummary = {
      total: requests?.length || 0,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byMonth: {} as Record<string, number>,
      avgCompletionDays: 0,
      completedCount: 0,
    };

    requests?.forEach(r => {
      // По статусам
      requestsSummary.byStatus[r.status] = (requestsSummary.byStatus[r.status] || 0) + 1;
      
      // По приоритетам
      if (r.priority) {
        requestsSummary.byPriority[r.priority] = (requestsSummary.byPriority[r.priority] || 0) + 1;
      }
      
      // По месяцам
      const month = r.created_at?.substring(0, 7);
      if (month) {
        requestsSummary.byMonth[month] = (requestsSummary.byMonth[month] || 0) + 1;
      }

      // Среднее время выполнения
      if (r.status === 'Доставлено' && r.delivery_date && r.created_at) {
        const created = new Date(r.created_at);
        const delivered = new Date(r.delivery_date);
        const days = Math.ceil((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days < 365) {
          requestsSummary.avgCompletionDays += days;
          requestsSummary.completedCount++;
        }
      }
    });

    if (requestsSummary.completedCount > 0) {
      requestsSummary.avgCompletionDays = Math.round(requestsSummary.avgCompletionDays / requestsSummary.completedCount);
    }

    const dataContext = JSON.stringify(requestsSummary, null, 2);

    switch (type) {
      case 'deadline-prediction':
        systemPrompt = `Ты - аналитик, который прогнозирует сроки выполнения заявок на основе исторических данных.
Проанализируй статистику и дай прогноз для новых заявок разных приоритетов.
Ответ должен быть на русском языке.`;
        userPrompt = `Статистика заявок за последние 12 месяцев:\n${dataContext}\n\nДай прогноз сроков выполнения для заявок с разным приоритетом.`;
        break;

      case 'report-generation':
        systemPrompt = `Ты - аналитик, который создаёт отчёты по заявкам.
Создай ${period === 'weekly' ? 'еженедельный' : 'ежемесячный'} отчёт на основе предоставленных данных.
Отчёт должен включать: общую статистику, тренды, проблемные области и рекомендации.
Ответ должен быть на русском языке в формате markdown.`;
        userPrompt = `Статистика заявок:\n${dataContext}\n\nСоздай ${period === 'weekly' ? 'еженедельный' : 'ежемесячный'} отчёт.`;
        break;

      case 'predictive-analytics':
        systemPrompt = `Ты - аналитик, который прогнозирует нагрузку и потребность в ресурсах.
На основе исторических данных спрогнозируй:
1. Ожидаемое количество заявок на следующий месяц
2. Пиковые периоды нагрузки
3. Рекомендации по распределению ресурсов
Ответ должен быть на русском языке.`;
        userPrompt = `Статистика заявок за последние 12 месяцев:\n${dataContext}\n\nСделай предиктивный анализ.`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid analysis type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

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
          { role: 'user', content: userPrompt }
        ],
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
    const content = data.choices?.[0]?.message?.content || 'Не удалось получить анализ';

    return new Response(
      JSON.stringify({ analysis: content, stats: requestsSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
