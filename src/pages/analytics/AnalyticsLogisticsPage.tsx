import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/analytics/MetricCard";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import {
  AnalyticsRequest,
  StatusGroups,
  avg,
  daysBetween,
  inPeriod,
  useAnalyticsRequests,
} from "@/hooks/useAnalyticsRequests";
import { Loader2 } from "lucide-react";

export default function AnalyticsLogisticsPage() {
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);

  const rows = useMemo(() => data.filter((r) => inPeriod(r, period.from, period.to)), [data, period]);

  const inTransit = rows.filter((r) => StatusGroups.IN_TRANSIT.has(r.status ?? ""));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const deliveryToday = rows.filter((r) => {
    if (!r.delivery_date) return false;
    const d = new Date(r.delivery_date);
    return d >= today && d < tomorrow;
  });
  const overdueShipment = rows.filter(
    (r) =>
      r.shipment_date &&
      !StatusGroups.IN_TRANSIT.has(r.status ?? "") &&
      !StatusGroups.DELIVERED.has(r.status ?? "") &&
      new Date(r.shipment_date).getTime() < today.getTime(),
  );
  const overdueDelivery = rows.filter(
    (r) =>
      r.delivery_date &&
      !StatusGroups.DELIVERED.has(r.status ?? "") &&
      new Date(r.delivery_date).getTime() < today.getTime(),
  );
  const delivered = rows.filter((r) => StatusGroups.DELIVERED.has(r.status ?? ""));
  const avgDelivery = avg(delivered.map((r) => daysBetween(r.shipment_date, r.actual_arrival_date)));

  const byTk = useMemo(() => {
    const m = new Map<string, AnalyticsRequest[]>();
    for (const r of rows) {
      const tk = (r.transport_company ?? "").trim();
      if (!tk) continue;
      if (!m.has(tk)) m.set(tk, []);
      m.get(tk)!.push(r);
    }
    return Array.from(m.entries())
      .map(([tk, list]) => {
        const del = list.filter((r) => StatusGroups.DELIVERED.has(r.status ?? ""));
        const onTime = del.filter((r) => {
          const target = r.delivery_date;
          if (!target || !r.actual_arrival_date) return true;
          return new Date(r.actual_arrival_date).getTime() <= new Date(target).getTime() + 86400000;
        }).length;
        return {
          tk,
          total: list.length,
          delivered: del.length,
          onTimePct: del.length ? Math.round((onTime / del.length) * 100) : 0,
          avgDays: avg(del.map((r) => daysBetween(r.shipment_date, r.actual_arrival_date))),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Аналитика · Логистика</h1>
        <p className="text-sm text-muted-foreground">Перевозки и эффективность ТК.</p>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="В пути" value={inTransit.length} to="/requests?status=В+пути" />
        <MetricCard label="Доставка сегодня" value={deliveryToday.length} tone="warning" />
        <MetricCard label="Просрочка отгрузки" value={overdueShipment.length} tone="danger" />
        <MetricCard label="Просрочка доставки" value={overdueDelivery.length} tone="danger" />
        <MetricCard
          label="Ср. время доставки"
          value={avgDelivery === null ? "—" : `${avgDelivery.toFixed(1)} дн`}
        />
      </div>

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Транспортная компания</TableHead>
              <TableHead className="text-right">Всего</TableHead>
              <TableHead className="text-right">Доставлено</TableHead>
              <TableHead className="text-right">% в срок</TableHead>
              <TableHead className="text-right">Ср. дни</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byTk.map((r) => (
              <TableRow key={r.tk}>
                <TableCell className="font-medium">{r.tk}</TableCell>
                <TableCell className="text-right font-numeric">{r.total}</TableCell>
                <TableCell className="text-right font-numeric">{r.delivered}</TableCell>
                <TableCell className="text-right font-numeric">{r.onTimePct}%</TableCell>
                <TableCell className="text-right font-numeric">
                  {r.avgDays === null ? "—" : r.avgDays.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
            {!byTk.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
