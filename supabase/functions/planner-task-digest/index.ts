// Twice-daily digest of open planner tasks into MAX "Список задач" group(s).
// Each task message carries a "✅ Выполнено" inline button (payload taskdone:<task_id>).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_API = "https://platform-api.max.ru";
const NOTIFICATION_TYPE = "incoming";
const MAX_TASKS_PER_GROUP = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Срочно",
  high: "Высокий",
  normal: "Планово",
  low: "Низкий",
};

function fmtDate(d: string | null): string {
  if (!d) return "без срока";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "без срока";
  return `${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`;
}

async function sendMax(chatId: string, text: string, attachments?: unknown) {
  const token = Deno.env.get("MAX_BOT_TOKEN");
  if (!token) return { ok: false, status: 0, body: "MAX_BOT_TOKEN not configured" };
  const body: Record<string, unknown> = { text };
  if (attachments) body.attachments = attachments;
  const res = await fetch(`${MAX_API}/messages?chat_id=${encodeURIComponent(chatId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const respText = await res.text();
  return { ok: res.ok, status: res.status, body: respText.slice(0, 500) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: groups } = await supabase
      .from("max_groups")
      .select("group_id, group_name, organization_id")
      .eq("notification_type", NOTIFICATION_TYPE)
      .eq("is_active", true);

    const todayIso = new Date().toISOString().slice(0, 10);
    let sent = 0;
    const results: unknown[] = [];

    for (const g of groups ?? []) {
      const { data: tasks } = await supabase
        .from("planner_tasks")
        .select("id, title, due_date, priority, status, assignee_id, assignee_name")
        .eq("organization_id", g.organization_id)
        .eq("hidden_auto", false)
        .is("archived_at", null)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(200);

      const open = tasks ?? [];
      if (open.length === 0) {
        results.push({ group_id: g.group_id, tasks: 0 });
        continue;
      }

      // Resolve assignee names
      const ids = [...new Set(open.map((t) => t.assignee_id).filter(Boolean))] as string[];
      const nameById = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profiles ?? []) nameById.set(p.id as string, (p.full_name as string) ?? "");
      }

      const overdue = open.filter((t) => t.due_date && String(t.due_date).slice(0, 10) < todayIso);
      const today = open.filter((t) => t.due_date && String(t.due_date).slice(0, 10) === todayIso);

      const header =
        `🗒 Список задач` + "\n\n" +
        `Всего открытых — ${open.length}` + "\n" +
        `Просрочено — ${overdue.length}` + "\n" +
        `На сегодня — ${today.length}`;
      const h = await sendMax(String(g.group_id), header);
      results.push({ group_id: g.group_id, header: h.status });

      // Priority: overdue, then today, then the rest
      const rest = open.filter((t) => !overdue.includes(t) && !today.includes(t));
      const ordered = [...overdue, ...today, ...rest].slice(0, MAX_TASKS_PER_GROUP);

      for (const t of ordered) {
        const isOverdue = t.due_date && String(t.due_date).slice(0, 10) < todayIso;
        const who = t.assignee_id
          ? (nameById.get(t.assignee_id as string) || t.assignee_name || "не назначен")
          : (t.assignee_name || "не назначен");
        const text =
          `${isOverdue ? "🔴" : "📋"} ${t.title}` + "\n" +
          `👤 ${who}` + "\n" +
          `📅 Срок — ${fmtDate(t.due_date as string | null)}${isOverdue ? " (просрочено)" : ""}` + "\n" +
          `⭐ ${PRIORITY_LABEL[String(t.priority)] ?? String(t.priority)}`;

        const attachments = [{
          type: "inline_keyboard",
          payload: {
            buttons: [[{ type: "callback", text: "✅ Выполнено", payload: `taskdone:${t.id}` }]],
          },
        }];
        const r = await sendMax(String(g.group_id), text, attachments);
        if (r.ok) sent++;
        else console.error("planner-task-digest send failed:", r.status, r.body);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, groups: (groups ?? []).length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("planner-task-digest error:", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
