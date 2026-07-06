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
  name: "get_request",
  title: "Детали заявки",
  description:
    "Возвращает полную карточку заявки по её id: описание, статус, суммы, контрагент, даты отгрузки/доставки, комментарии.",
  inputSchema: {
    request_id: z.string().uuid().describe("UUID заявки."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ request_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Не авторизован" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Ошибка: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Заявка не найдена или нет доступа." }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { request: data },
    };
  },
});
