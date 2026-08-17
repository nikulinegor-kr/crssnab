import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Package, Building2, ReceiptText, Truck, Wallet, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buildSummary, childTotal, type ProjectChild } from "@/hooks/useProjects";

const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

const CHILD_FIELDS =
  "id, request_number, description, status, priority, contractor, invoice_number, invoice_number_2, invoice_number_3, amount, amount_2, amount_3, payment_percent, payment_status, executor, shipment_date, delivery_date, object_id";

/** Баннер проекта: для родительской заявки — сводка и дерево, для дочерней — ссылка на проект */
export function RequestProjectBanner({
  requestId,
  isProject,
  parentRequestId,
}: {
  requestId: string;
  isProject: boolean;
  parentRequestId: string | null;
}) {
  const { data: parent } = useQuery({
    queryKey: ["request-parent-project", parentRequestId],
    enabled: !!parentRequestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, description, request_number")
        .eq("id", parentRequestId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["project-children", requestId],
    enabled: isProject,
    queryFn: async (): Promise<ProjectChild[]> => {
      const { data, error } = await supabase
        .from("requests")
        .select(CHILD_FIELDS)
        .eq("parent_request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: ships } = await supabase
          .from("request_shipments")
          .select("request_id")
          .in("request_id", ids);
        for (const s of ships ?? []) counts[s.request_id] = (counts[s.request_id] ?? 0) + 1;
      }
      return (data ?? []).map((r: any) => ({
        ...r,
        object_name: null,
        shipments_count: counts[r.id] ?? 0,
      }));
    },
  });

  if (parentRequestId && parent) {
    return (
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted"
      >
        <FolderOpen className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Проект:</span>
        <span className="font-medium">{parent.description || parent.request_number}</span>
      </Link>
    );
  }

  if (!isProject) return null;

  const s = buildSummary(children);

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Родительская заявка (проект)</span>
        <Badge variant="outline" className="text-[10px]">{s.computedStatus}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <Chip icon={Package} label={`Заявок: ${s.requests}`} />
        <Chip icon={Building2} label={`Поставщиков: ${s.suppliers}`} />
        <Chip icon={ReceiptText} label={`Счетов: ${s.invoices}`} />
        <Chip icon={Truck} label={`Перевозок: ${s.shipments}`} />
        <Chip icon={Wallet} label={`Сумма: ${money(s.totalAmount)}`} />
        <Chip icon={TrendingUp} label={`Выполнено: ${s.progress}%`} />
      </div>
      <Progress value={s.progress} className="mt-2 h-1.5 max-w-xs" />
      <div className="mt-1 text-[11px] text-muted-foreground font-numeric tabular-nums">
        Оплачено {money(s.paidAmount)} · Не оплачено {money(s.unpaidAmount)} · Доставлено {s.delivered} ·
        В пути {s.inTransit} · Просрочено {s.overdue}
      </div>

      <div className="mt-3 divide-y rounded-md border">
        {children.length === 0 ? (
          <div className="px-3 py-2 text-xs italic text-muted-foreground">
            В проекте пока нет дочерних заявок
          </div>
        ) : (
          children.map((c) => (
            <div key={c.id} className="flex items-start gap-2 px-3 py-2">
              <span className="mt-0.5 text-muted-foreground/60">├─</span>
              <div className="min-w-0 flex-1">
                <Link to={`/requests/${c.id}`} className="text-sm font-medium hover:underline">
                  {c.description || c.request_number}
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {c.contractor || "—"} · Счёт: {c.invoice_number || "—"} ·{" "}
                  <span className="font-numeric tabular-nums">
                    {childTotal(c) ? money(childTotal(c)) : "—"}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function Chip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
