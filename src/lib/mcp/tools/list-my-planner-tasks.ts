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
  name: "list_my_planner_tasks",
  title: "Мои задачи планировщика",
  description:
    "Возвращает задачи персонального планировщика текущего пользователя. Можно отфильтровать по статусу и диапазону 'today'/'upcoming'/'overdue'/'all'.",
  inputSchema: {
    status: z.string().optional().describe("Статус задачи: 'todo', 'in_progress', 'done' и т.п."),
    scope: z
      .enum(["today", "upcoming", "overdue", "all"])
      .optional()
      .describe("Временной срез: сегодня/ближайшие/просроченные/все."),
    limit: z.number().int().min(1).max(100).optional().describe("Максимум записей (по умолчанию 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, scope, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Не авторизован" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    let q = sb
      .from("planner_tasks")
      .select("id,title,description,status,priority,due_date,start_date,tags,object_id,assignee_id,created_by")
      .or(`assignee_id.eq.${uid},created_by.eq.${uid}`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit ?? 25);

    if (status) q = q.eq("status", status);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    if (scope === "today") {
      q = q.gte("due_date", startOfToday).lt("due_date", endOfToday);
    } else if (scope === "upcoming") {
      q = q.gte("due_date", endOfToday);
    } else if (scope === "overdue") {
      q = q.lt("due_date", startOfToday).neq("status", "done");
    }

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Ошибка: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [], count: data?.length ?? 0 },
    };
  },
});
