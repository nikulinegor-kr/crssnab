import { useQuery } from "@tanstack/react-query";
import { format, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { CLOSED_REQUEST_STATUSES } from "@/lib/requestStaleness";
import { periodStart, type ExecRequestRow } from "@/lib/executiveSnapshot";

const closedFilter = `(${CLOSED_REQUEST_STATUSES.map(s => `"${s}"`).join(",")})`;
const cols = "id,request_number,description,comments,status,priority,executor,object_id,amount,amount_2,amount_3,payment_percent,payment_percentage,planned_delivery_date,actual_arrival_date,delivery_date,transport_company,created_at,updated_at,object:request_objects(name)";
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) { const { data, error } = await page(from, from + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) return out; }
}
export type ExecTaskRow = { id: string; title: string; due_date: string | null; assignee_name: string | null; object: { name: string } | null };

export function useExecutiveSnapshot(periodDays: number) {
  const { currentOrgId: orgId } = useCurrentOrganization();
  const today = startOfToday(); const day = format(today, "yyyy-MM-dd");
  const from = periodStart(today, periodDays).toISOString();
  const o = { enabled: Boolean(orgId), staleTime: 60_000 };
  const open = useQuery({ ...o, queryKey: ["executive", orgId, "snap-open", day], queryFn: () => allRows<ExecRequestRow>((a, b) =>
    supabase.from("requests").select(cols).eq("organization_id", orgId!).eq("archived", false).eq("is_project", false).not("status", "in", closedFilter).order("id").range(a, b) as never) });
  const tasks = useQuery({ ...o, queryKey: ["executive", orgId, "snap-tasks", day], queryFn: async () => {
    const { data, error } = await supabase.from("planner_tasks").select("id,title,due_date,assignee_name,object:request_objects(name)").eq("organization_id", orgId!).is("archived_at", null).eq("hidden_auto", false).neq("status", "done").lt("due_date", today.toISOString()).order("due_date").limit(500);
    if (error) throw error; return (data ?? []) as unknown as ExecTaskRow[];
  }});
  const completed = useQuery({ ...o, queryKey: ["executive", orgId, "snap-done", day, periodDays], queryFn: () => allRows<ExecRequestRow>((a, b) =>
    supabase.from("requests").select(cols).eq("organization_id", orgId!).eq("is_project", false).in("status", ["Доставлено", "Выполнено", "Закрыто"]).gte("updated_at", from).order("id").range(a, b) as never) });
  const warehouse = useQuery({ ...o, queryKey: ["executive", orgId, "snap-wh", day, periodDays], queryFn: async () => {
    const rows = await allRows<{ operation: string }>((a, b) => supabase.from("warehouse_ledger").select("operation").eq("organization_id", orgId!).gte("created_at", from).order("id").range(a, b) as never);
    const m = new Map<string, number>(); rows.forEach(r => m.set(r.operation, (m.get(r.operation) ?? 0) + 1)); return m;
  }});
  const all = [open, tasks, completed, warehouse];
  const updatedAt = all.every(q => q.dataUpdatedAt) ? Math.min(...all.map(q => q.dataUpdatedAt)) : 0;
  return { orgId, today, open, tasks, completed, warehouse, updatedAt, fetching: all.some(q => q.isFetching), refetch: () => Promise.all(all.map(q => q.refetch())) };
}
