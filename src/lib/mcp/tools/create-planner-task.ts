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
  name: "create_planner_task",
  title: "Создать задачу в планировщике",
  description:
    "Создаёт новую задачу в персональном планировщике текущего пользователя (назначается ему же).",
  inputSchema: {
    title: z.string().trim().min(1).max(500).describe("Название задачи."),
    description: z.string().max(5000).optional().describe("Подробное описание."),
    due_date: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("ISO-дата дедлайна, напр. '2026-07-10T15:00:00Z'."),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Приоритет."),
    tags: z.array(z.string()).max(20).optional().describe("Метки."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, description, due_date, priority, tags }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Не авторизован" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    // Найти организацию пользователя
    const { data: org, error: orgErr } = await sb
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    if (orgErr || !org) {
      return {
        content: [{ type: "text", text: "Не удалось определить организацию пользователя." }],
        isError: true,
      };
    }

    const { data, error } = await sb
      .from("planner_tasks")
      .insert({
        organization_id: org.organization_id,
        title,
        description: description ?? null,
        due_date: due_date ?? null,
        priority: priority ?? "medium",
        tags: tags ?? [],
        status: "todo",
        assignee_id: uid,
        created_by: uid,
        source: "mcp",
      })
      .select()
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Ошибка: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Задача создана: ${data.id}` }],
      structuredContent: { task: data },
    };
  },
});
