import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectChild {
  id: string;
  request_number: string;
  description: string | null;
  status: string;
  priority: string | null;
  contractor: string | null;
  invoice_number: string | null;
  invoice_number_2: string | null;
  invoice_number_3: string | null;
  amount: number | null;
  amount_2: number | null;
  amount_3: number | null;
  payment_percent: number | null;
  payment_status: string | null;
  executor: string | null;
  shipment_date: string | null;
  delivery_date: string | null;
  object_id: string | null;
  object_name: string | null;
  shipments_count: number;
}

export interface ProjectSummary {
  requests: number;
  suppliers: number;
  invoices: number;
  shipments: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  delivered: number;
  inTransit: number;
  overdue: number;
  emergency: number;
  progress: number;
  computedStatus: string;
}

export interface ProjectNode {
  id: string;
  request_number: string;
  description: string | null;
  status: string;
  executor: string | null;
  applicant: string | null;
  object_id: string | null;
  object_name: string | null;
  created_at: string;
  children: ProjectChild[];
  summary: ProjectSummary;
}

const DELIVERED_STATUSES = ["Доставлено", "Выполнено", "Завершено"];
const TRANSIT_STATUSES = ["В пути", "Доставлено в ТК", "Отгружено"];

export const childTotal = (c: ProjectChild) =>
  (Number(c.amount) || 0) + (Number(c.amount_2) || 0) + (Number(c.amount_3) || 0);

const invoiceCount = (c: ProjectChild) =>
  [c.invoice_number, c.invoice_number_2, c.invoice_number_3].filter(
    (v) => v && String(v).trim()
  ).length;

export function buildSummary(children: ProjectChild[]): ProjectSummary {
  const now = new Date();
  let totalAmount = 0;
  let paidAmount = 0;
  let invoices = 0;
  let shipments = 0;
  let delivered = 0;
  let inTransit = 0;
  let overdue = 0;
  let emergency = 0;
  const suppliers = new Set<string>();

  for (const c of children) {
    const total = childTotal(c);
    totalAmount += total;
    paidAmount += (total * (Number(c.payment_percent) || 0)) / 100;
    invoices += invoiceCount(c);
    shipments += c.shipments_count || 0;
    if (c.contractor?.trim()) suppliers.add(c.contractor.trim().toLowerCase());
    const isDelivered = DELIVERED_STATUSES.includes(c.status);
    if (isDelivered) delivered += 1;
    else if (TRANSIT_STATUSES.includes(c.status)) inTransit += 1;
    if (!isDelivered && c.delivery_date && new Date(c.delivery_date) < now) overdue += 1;
    if (c.priority === "Аварийно") emergency += 1;
  }

  const progress = children.length
    ? Math.round((delivered / children.length) * 100)
    : 0;

  let computedStatus = "В работе";
  if (children.length === 0) computedStatus = "Нет заявок";
  else if (delivered === children.length) computedStatus = "Проект завершён";
  else if (emergency > 0) computedStatus = "Аварийная ситуация";
  else if (inTransit > 0) computedStatus = "В пути";
  else if (paidAmount < totalAmount - 0.5) computedStatus = "Ожидает оплаты";

  return {
    requests: children.length,
    suppliers: suppliers.size,
    invoices,
    shipments,
    totalAmount,
    paidAmount,
    unpaidAmount: Math.max(totalAmount - paidAmount, 0),
    delivered,
    inTransit,
    overdue,
    emergency,
    progress,
    computedStatus,
  };
}

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects-tree"],
    queryFn: async (): Promise<ProjectNode[]> => {
      const { data: projects, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, executor, applicant, object_id, created_at, request_objects(name)")
        .eq("is_project", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (projects ?? []).map((p: any) => p.id);
      if (ids.length === 0) return [];

      const { data: childRows, error: childErr } = await supabase
        .from("requests")
        .select(
          "id, request_number, description, status, priority, contractor, invoice_number, invoice_number_2, invoice_number_3, amount, amount_2, amount_3, payment_percent, payment_status, executor, shipment_date, delivery_date, object_id, parent_request_id, request_objects(name)"
        )
        .in("parent_request_id", ids)
        .order("created_at", { ascending: true });
      if (childErr) throw childErr;

      const childIds = (childRows ?? []).map((c: any) => c.id);
      const shipCount: Record<string, number> = {};
      if (childIds.length) {
        const { data: ships } = await supabase
          .from("request_shipments")
          .select("request_id")
          .in("request_id", childIds);
        for (const s of ships ?? []) {
          shipCount[s.request_id] = (shipCount[s.request_id] ?? 0) + 1;
        }
      }

      const byParent: Record<string, ProjectChild[]> = {};
      for (const row of childRows ?? []) {
        const c: ProjectChild = {
          ...(row as any),
          object_name: (row as any).request_objects?.name ?? null,
          shipments_count: shipCount[(row as any).id] ?? 0,
        };
        const key = (row as any).parent_request_id as string;
        (byParent[key] ||= []).push(c);
      }

      return (projects ?? []).map((p: any) => {
        const children = byParent[p.id] ?? [];
        return {
          id: p.id,
          request_number: p.request_number,
          description: p.description,
          status: p.status,
          executor: p.executor,
          applicant: p.applicant,
          object_id: p.object_id,
          object_name: p.request_objects?.name ?? null,
          created_at: p.created_at,
          children,
          summary: buildSummary(children),
        };
      });
    },
  });
};

/** Простой список проектов для селектов */
export const useProjectOptions = () => {
  return useQuery({
    queryKey: ["project-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, description, request_number")
        .eq("is_project", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; description: string | null; request_number: string }[];
    },
  });
};

export const useAttachRequestsToProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, requestIds }: { projectId: string | null; requestIds: string[] }) => {
      const { error } = await supabase
        .from("requests")
        .update({ parent_request_id: projectId })
        .in("id", requestIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-tree"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
};

/** Синхронизация статуса проекта с расчётным */
export const useSyncProjectStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const { error } = await supabase.from("requests").update({ status }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects-tree"] }),
  });
};
