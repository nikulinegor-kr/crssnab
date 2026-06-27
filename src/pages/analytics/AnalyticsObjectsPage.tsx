import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import {
  AnalyticsRequest,
  avg,
  daysBetween,
  inPeriod,
  totalAmount,
  useAnalyticsRequests,
} from "@/hooks/useAnalyticsRequests";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Loader2 } from "lucide-react";

type ObjectRow = { id: string; name: string };

export default function AnalyticsObjectsPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);
  const [objects, setObjects] = useState<ObjectRow[]>([]);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("request_objects")
      .select("id,name")
      .eq("organization_id", currentOrgId)
      .then(({ data }) => setObjects((data as ObjectRow[]) ?? []));
  }, [currentOrgId]);

  const rows = useMemo(() => {
    const filtered = data.filter((r) => inPeriod(r, period.from, period.to));
    const byObj = new Map<string, AnalyticsRequest[]>();
    for (const r of filtered) {
      const k = r.object_id ?? "—";
      if (!byObj.has(k)) byObj.set(k, []);
      byObj.get(k)!.push(r);
    }
    const objMap = new Map(objects.map((o) => [o.id, o.name]));
    return Array.from(byObj.entries())
      .map(([id, list]) => {
        const amount = list.reduce((s, r) => s + totalAmount(r), 0);
        const avgDays = avg(list.map((r) => daysBetween(r.created_at, r.actual_arrival_date)));
        const emergency = list.filter((r) => (r.priority ?? "").toLowerCase().includes("авар")).length;
        const topExpensive = [...list].sort((a, b) => totalAmount(b) - totalAmount(a)).slice(0, 3);
        return {
          id,
          name: objMap.get(id) ?? "Без объекта",
          total: list.length,
          amount,
          emergency,
          avgDays,
          topExpensive,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [data, period, objects]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Аналитика · Объекты</h1>
        <p className="text-sm text-muted-foreground">Заявки и расходы по объектам.</p>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Объект</TableHead>
              <TableHead className="text-right">Заявок</TableHead>
              <TableHead className="text-right">Аварийных</TableHead>
              <TableHead className="text-right">Ср. срок поставки</TableHead>
              <TableHead className="text-right">Сумма закупок</TableHead>
              <TableHead>Самые дорогие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right font-numeric">{r.total}</TableCell>
                <TableCell className="text-right font-numeric text-destructive">{r.emergency}</TableCell>
                <TableCell className="text-right font-numeric">
                  {r.avgDays === null ? "—" : `${r.avgDays.toFixed(1)} дн`}
                </TableCell>
                <TableCell className="text-right font-numeric">
                  {Math.round(r.amount).toLocaleString("ru-RU")} ₽
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.topExpensive.map((x) => x.description).filter(Boolean).join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Нет данных за выбранный период
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
