import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_requests",
  title: "Список заявок",
  description:
    "Возвращает список заявок (снабжение) организации пользователя. Поддерживает фильтр по статусу, приоритету, поисковой строке и лимит.",
  inputSchema: {
    status: z.string().optional().describe("Фильтр по статусу, напр. 'В работе', 'Доставлено'."),
    priority: z.string().optional().describe("Фильтр по приоритету: 'Аварийно', 'Приоритетно', 'Планово'."),
    search: z.string().optional().describe("Поиск по описанию/контрагенту."),
    archived: z.boolean().optional().describe("Показывать архивные (по умолчанию false)."),
    limit: z.number().int().min(1).max(100).optional().describe("Максимум записей (по умолчанию 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, priority, search, archived, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Не авторизован" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("requests")
      .select(
        "id,request_number,request_date,description,status,priority,contractor,executor,applicant,amount,delivery_date,archived"
      )
      .eq("archived", archived ?? false)
      .order("request_date", { ascending: false })
      .limit(limit ?? 25);

    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority", priority);
    if (search) q = q.or(`description.ilike.%${search}%,contractor.ilike.%${search}%`);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Ошибка: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { requests: data ?? [], count: data?.length ?? 0 },
    };
  },
});
