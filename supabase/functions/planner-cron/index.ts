import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Recurring tasks: when a task with recurrence is marked done — create the next instance
    const { data: doneRecurring } = await supabase
      .from("planner_tasks")
      .select("*")
      .eq("status", "done")
      .not("recurrence", "is", null)
      .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    let createdRecurring = 0;
    for (const t of doneRecurring ?? []) {
      const rec = t.recurrence as { freq: string; interval?: number; until?: string | null };
      if (!rec?.freq) continue;
      if (rec.until && new Date(rec.until) < now) continue;

      // Check if next instance already exists
      const { data: existing } = await supabase
        .from("planner_tasks")
        .select("id")
        .eq("parent_task_id", t.id)
        .limit(1);
      if (existing && existing.length) continue;

      const interval = rec.interval ?? 1;
      const bumpDate = (d: string | null) => {
        if (!d) return null;
        const x = new Date(d);
        if (rec.freq === "daily") x.setDate(x.getDate() + interval);
        else if (rec.freq === "weekly") x.setDate(x.getDate() + 7 * interval);
        else if (rec.freq === "monthly") x.setMonth(x.getMonth() + interval);
        return x.toISOString();
      };

      const next = {
        organization_id: t.organization_id,
        title: t.title,
        description: t.description,
        status: "todo",
        priority: t.priority,
        assignee_id: t.assignee_id,
        object_id: t.object_id,
        stage_id: t.stage_id,
        start_date: bumpDate(t.start_date),
        due_date: bumpDate(t.due_date),
        tags: t.tags,
        checklist: (t.checklist ?? []).map((c: any) => ({ ...c, done: false })),
        is_private: t.is_private,
        recurrence: t.recurrence,
        parent_task_id: t.id,
        estimated_hours: t.estimated_hours,
        position: t.position,
        created_by: t.created_by,
      };
      const { error } = await supabase.from("planner_tasks").insert(next);
      if (!error) createdRecurring++;
    }

    // 2. Deadline notifications: tasks due within 24h, not done, not yet notified today
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: dueSoon } = await supabase
      .from("planner_tasks")
      .select("id, title, due_date, assignee_id, organization_id")
      .neq("status", "done")
      .not("due_date", "is", null)
      .gte("due_date", nowIso)
      .lte("due_date", in24h);

    let notified = 0;
    for (const t of dueSoon ?? []) {
      if (!t.assignee_id) continue;
      // Log activity as notification marker (idempotent via unique check below not enforced, so we add a date suffix)
      const today = nowIso.slice(0, 10);
      const { data: already } = await supabase
        .from("planner_task_activity")
        .select("id")
        .eq("task_id", t.id)
        .eq("action", "deadline_reminder")
        .gte("created_at", today)
        .limit(1);
      if (already && already.length) continue;

      await supabase.from("planner_task_activity").insert({
        task_id: t.id,
        organization_id: t.organization_id,
        user_id: t.assignee_id,
        action: "deadline_reminder",
        description: `Дедлайн через сутки: ${t.title}`,
      });
      notified++;
    }

    return new Response(
      JSON.stringify({ ok: true, createdRecurring, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("planner-cron error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
