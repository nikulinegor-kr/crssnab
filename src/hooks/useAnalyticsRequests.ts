import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";

export type AnalyticsRequest = {
  id: string;
  request_number: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  executor: string | null;
  applicant: string | null;
  contractor: string | null;
  object_id: string | null;
  amount: number | null;
  amount_2: number | null;
  amount_3: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  payment_status: string | null;
  payment_percentage: number | null;
  transport_company: string | null;
  shipment_date: string | null;
  delivery_date: string | null;
  planned_delivery_date: string | null;
  actual_arrival_date: string | null;
  archived: boolean | null;
  created_at: string;
  updated_at: string;
  organization_id: string;
};

const PAGE = 1000;

export function useAnalyticsRequests() {
  const { currentOrgId } = useCurrentOrganization();
  const [data, setData] = useState<AnalyticsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentOrgId) {
        setData([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const all: AnalyticsRequest[] = [];
        let from = 0;
        // paginate over .range to bypass 1000 row limit
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: rows, error: err } = await supabase
            .from("requests")
            .select(
              "id,request_number,description,status,priority,executor,applicant,contractor,object_id,amount,amount_2,amount_3,invoice_number,invoice_date,payment_status,payment_percentage,transport_company,shipment_date,delivery_date,planned_delivery_date,actual_arrival_date,archived,created_at,updated_at,organization_id",
            )
            .eq("organization_id", currentOrgId)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (err) throw err;
          if (!rows || rows.length === 0) break;
          all.push(...(rows as AnalyticsRequest[]));
          if (rows.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelled) setData(all);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrgId]);

  return { data, loading, error, orgId: currentOrgId };
}

export function totalAmount(r: AnalyticsRequest): number {
  return (r.amount ?? 0) + (r.amount_2 ?? 0) + (r.amount_3 ?? 0);
}

export function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.max(0, Math.round((t2 - t1) / 86400000));
}

export function avg(nums: (number | null | undefined)[]): number | null {
  const xs = nums.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!xs.length) return null;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

const DELIVERED = new Set(["Доставлено"]);
const IN_TRANSIT = new Set(["В пути", "Отправлено", "Доставлено в ТК"]);
const NEW_STATUSES = new Set(["Новая заявка", "Входящая заявка"]);
const CANCELLED = new Set(["Отменено", "Отклонено", "Закрыто"]);

export const StatusGroups = { DELIVERED, IN_TRANSIT, NEW_STATUSES, CANCELLED };

export function isOverdue(r: AnalyticsRequest): boolean {
  if (DELIVERED.has(r.status ?? "") || CANCELLED.has(r.status ?? "") || r.archived) return false;
  const target = r.delivery_date ?? r.planned_delivery_date;
  if (!target) return false;
  return new Date(target).getTime() < Date.now();
}

export function inPeriod(r: AnalyticsRequest, from: Date, to: Date): boolean {
  const t = new Date(r.created_at).getTime();
  return t >= from.getTime() && t <= to.getTime();
}
