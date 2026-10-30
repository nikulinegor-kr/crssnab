import { useQuery } from "@tanstack/react-query";
import { format, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { CLOSED_REQUEST_STATUSES, getStaleDays, isStale } from "@/lib/requestStaleness";
import { overdueDays, sortAttention, sortEvents, sortObjects, type ExecAttentionItem, type ExecEvent, type ExecObjectLoad } from "@/lib/executivePanel";

const closedFilter = `(${CLOSED_REQUEST_STATUSES.map(s => `"${s}"`).join(",")})`;
const staleTime = 60_000;

async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < 1000) return result;
  }
}

export function useExecutivePanel() {
  const { currentOrgId: orgId } = useCurrentOrganization();
  const today = startOfToday();
  const day = format(today, "yyyy-MM-dd");
  const options = { enabled: Boolean(orgId), staleTime };
  const activeTasks = useQuery({ ...options, queryKey: ["executive", orgId, "active-tasks", day], queryFn: async () => {
    const { count, error } = await supabase.from("planner_tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId ?? "").eq("archived", false).neq("status", "done");
    if (error) throw error; return count ?? 0;
  }});
  const newRequests = useQuery({ ...options, queryKey: ["executive", orgId, "new-requests", day], queryFn: async () => {
    const { count, error } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("organization_id", orgId ?? "").eq("archived", false).eq("status", "Новая заявка");
    if (error) throw error; return count ?? 0;
  }});
  const openRequests = useQuery({ ...options, queryKey: ["executive", orgId, "open-requests", day], queryFn: async () => {
    const { count, error } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("organization_id", orgId ?? "").eq("archived", false).not("status", "in", closedFilter);
    if (error) throw error; return count ?? 0;
  }});
  const overdueTasks = useQuery({ ...options, queryKey: ["executive", orgId, "overdue-tasks", day], queryFn: async () => {
    const { count, error } = await supabase.from("planner_tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId ?? "").eq("archived", false).neq("status", "done").lt("due_date", today.toISOString());
    if (error) throw error; return count ?? 0;
  }});
  const overdueDeliveries = useQuery({ ...options, queryKey: ["executive", orgId, "overdue-deliveries", day], queryFn: async () => {
    const { count, error } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("organization_id", orgId ?? "").eq("archived", false).not("status", "in", closedFilter).lt("planned_delivery_date", day).is("actual_arrival_date", null);
    if (error) throw error; return count ?? 0;
  }});

  const attention = useQuery({ ...options, queryKey: ["executive", orgId, "attention", day], queryFn: async () => {
    const [tasks, requests] = await Promise.all([
      allRows((from, to) => supabase.from("planner_tasks").select("id,title,priority,due_date,assignee_name,object:request_objects(name)").eq("organization_id", orgId ?? "").eq("archived", false).neq("status", "done").lt("due_date", today.toISOString()).order("id").range(from, to)),
      allRows((from, to) => supabase.from("requests").select("id,request_number,description,status,priority,created_at,updated_at,object:request_objects(name)").eq("organization_id", orgId ?? "").eq("archived", false).not("status", "in", closedFilter).order("id").range(from, to)),
    ]);
    const items: ExecAttentionItem[] = tasks.map(t => ({ id: t.id, kind: "task", title: t.title, objectName: t.object?.name ?? null, assigneeName: t.assignee_name, priority: t.priority, days: t.due_date ? overdueDays(t.due_date, today) : 0 }));
    for (const r of requests) {
      const staleInput = { ...r, created_at: r.created_at ?? r.updated_at ?? "" };
      if (isStale(staleInput, today)) items.push({ id: r.id, kind: "request", title: r.description, reference: r.request_number.replace(/^REQ-/, ""), objectName: r.object?.name ?? null, priority: r.priority, days: getStaleDays(staleInput, today) });
    }
    return sortAttention(items);
  }});

  const objects = useQuery({ ...options, queryKey: ["executive", orgId, "objects", day], queryFn: async () => {
    const [objects, requests, tasks] = await Promise.all([
      allRows((from, to) => supabase.from("request_objects").select("id,name").eq("organization_id", orgId ?? "").eq("archived", false).eq("is_active", true).order("id").range(from, to)),
      allRows((from, to) => supabase.from("requests").select("object_id,amount,id").eq("organization_id", orgId ?? "").eq("archived", false).not("status", "in", closedFilter).order("id").range(from, to)),
      allRows((from, to) => supabase.from("planner_tasks").select("object_id,id").eq("organization_id", orgId ?? "").eq("archived", false).neq("status", "done").lt("due_date", today.toISOString()).order("id").range(from, to)),
    ]);
    const map = new Map<string, ExecObjectLoad>(objects.map(o => [o.id, { ...o, requests: 0, amount: 0, overdueTasks: 0 }]));
    for (const r of requests) { const o = r.object_id ? map.get(r.object_id) : undefined; if (o) { o.requests++; o.amount += r.amount ?? 0; } }
    for (const t of tasks) { const o = t.object_id ? map.get(t.object_id) : undefined; if (o) o.overdueTasks++; }
    return sortObjects([...map.values()]);
  }});

  const events = useQuery({ ...options, queryKey: ["executive", orgId, "events"], queryFn: async () => {
    const [requests, tasks] = await Promise.all([
      supabase.from("request_activities").select("id,request_id,user_id,description,action,created_at,request:requests(request_number)").eq("organization_id", orgId ?? "").not("created_at", "is", null).order("created_at", { ascending: false }).limit(10),
      supabase.from("planner_task_activity").select("id,task_id,user_id,description,action,created_at,task:planner_tasks(title)").eq("organization_id", orgId ?? "").order("created_at", { ascending: false }).limit(10),
    ]);
    if (requests.error) throw requests.error;
    if (tasks.error) throw tasks.error;
    const users = [...new Set([...(requests.data ?? []), ...(tasks.data ?? [])].flatMap(e => e.user_id ? [e.user_id] : []))];
    const names = new Map<string, string>();
    if (users.length) {
      const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", users);
      if (error) throw error;
      for (const p of data ?? []) names.set(p.id, p.full_name ?? "—");
    }
    const items: ExecEvent[] = [
      ...(requests.data ?? []).map(e => ({ id: `request-${e.id}`, kind: "request" as const, entityId: e.request_id, description: e.description?.trim() || e.action, reference: e.request?.request_number.replace(/^REQ-/, "") ?? "—", actor: names.get(e.user_id ?? "") ?? "—", createdAt: e.created_at })),
      ...(tasks.data ?? []).map(e => ({ id: `task-${e.id}`, kind: "task" as const, entityId: e.task_id, description: e.description?.trim() || e.action, reference: e.task?.title ?? "—", actor: names.get(e.user_id ?? "") ?? "—", createdAt: e.created_at })),
    ];
    return sortEvents(items);
  }});
  return { orgId, activeTasks, newRequests, openRequests, overdueTasks, overdueDeliveries, attention, objects, events };
}