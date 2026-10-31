import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRightLeft, PackageMinus, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface Op { key: string; kind: "move" | "issue"; at: string; qty: number; unit: string; name: string; from?: string; to?: string; recipient?: string | null }

/** Executive widget: posted warehouse moves and issues for the last 7 days (ledger only, drafts never appear). */
export function ExecWarehouseMoves({ orgId }: { orgId: string }) {
  const { hasRouteAccess } = useUserPermissions();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wh-qr", "executive-moves", orgId],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: rows, error } = await supabase.from("warehouse_ledger").select("id,document_id,line_id,unit_id,warehouse_id,operation,delta,created_at").eq("organization_id", orgId).in("operation", ["move_out", "move_in", "issue"]).gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      const unitIds = [...new Set((rows ?? []).map(r => r.unit_id))], docIds = [...new Set((rows ?? []).map(r => r.document_id))];
      const [u, w, d] = await Promise.all([
        unitIds.length ? supabase.from("warehouse_units").select("id,name,unit").in("id", unitIds.slice(0, 300)) : Promise.resolve({ data: [] as { id: string; name: string; unit: string }[], error: null }),
        supabase.from("warehouses").select("id,name").eq("organization_id", orgId),
        docIds.length ? supabase.from("warehouse_documents").select("id,recipient_name").in("id", docIds.slice(0, 300)) : Promise.resolve({ data: [] as { id: string; recipient_name: string | null }[], error: null }),
      ]);
      if (u.error || w.error || d.error) throw u.error ?? w.error ?? d.error;
      const wh = (id: string) => w.data?.find(x => x.id === id)?.name ?? "—";
      const ops = new Map<string, Op>();
      for (const r of rows ?? []) {
        const unit = u.data?.find(x => x.id === r.unit_id);
        const key = r.operation === "issue" ? String(r.id) : `${r.document_id}:${r.line_id}`;
        const op = ops.get(key) ?? { key, kind: r.operation === "issue" ? "issue" : "move", at: r.created_at, qty: Math.abs(Number(r.delta)), unit: unit?.unit ?? "", name: unit?.name ?? "—" } as Op;
        if (r.operation === "move_out") op.from = wh(r.warehouse_id);
        else if (r.operation === "move_in") op.to = wh(r.warehouse_id);
        else { op.from = wh(r.warehouse_id); op.recipient = d.data?.find(x => x.id === r.document_id)?.recipient_name; }
        ops.set(key, op);
      }
      return [...ops.values()];
    },
  });
  const moves = data?.filter(o => o.kind === "move").length ?? 0, issues = data?.filter(o => o.kind === "issue").length ?? 0;
  return <section className="min-w-0 rounded-lg border border-border p-3 space-y-3" aria-label="Склад и перемещения">
    <div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground" /><h2 className="flex-1 text-[15px] font-semibold">Склад и перемещения · 7 дней</h2>
      {hasRouteAccess("/warehouse") && <Button variant="outline" size="sm" asChild><Link to="/warehouse">Открыть склад</Link></Button>}</div>
    {isLoading ? <Skeleton className="h-24" /> : error ? <p role="alert" className="text-sm text-destructive">Не удалось загрузить склад</p> : <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground">Перемещений</div><div className="text-xl font-semibold font-numeric">{moves}</div></div>
        <div className="rounded-md bg-muted p-2"><div className="text-xs text-muted-foreground">Выдач</div><div className="text-xl font-semibold font-numeric">{issues}</div></div>
      </div>
      {!data?.length ? <p className="text-sm text-muted-foreground">За неделю операций не было</p> : <ul className="divide-y divide-border">{data.slice(0, 5).map(o => <li key={o.key} className="flex gap-2 py-2 text-sm">
        {o.kind === "move" ? <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <PackageMinus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1"><span className="block truncate">{o.name}</span><span className="block text-xs text-muted-foreground truncate">{o.kind === "move" ? `${o.from ?? "—"} → ${o.to ?? "—"}` : `${o.from} → ${o.recipient ?? "—"}`} · {new Date(o.at).toLocaleDateString("ru-RU")}</span></span>
        <span className="shrink-0 font-numeric">{o.qty} {o.unit}</span></li>)}</ul>}
    </>}
  </section>;
}
