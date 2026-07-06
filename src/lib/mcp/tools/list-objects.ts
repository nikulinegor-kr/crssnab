import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_objects",
  title: "Список объектов",
  description:
    "Возвращает объекты (стройплощадки/склады) организации пользователя. Полезно для контекста при создании задач/заявок.",
  inputSchema: {
    search: z.string().optional().describe("Поиск по имени объекта."),
    limit: z.number().int().min(1).max(200).optional().describe("Максимум записей (по умолчанию 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Не авторизован" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("request_objects")
      .select("id,name,address,status")
      .order("name", { ascending: true })
      .limit(limit ?? 50);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Ошибка: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { objects: data ?? [], count: data?.length ?? 0 },
    };
  },
});
