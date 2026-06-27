import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/analytics/MetricCard";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import {
  AnalyticsRequest,
  StatusGroups,
  avg,
  daysBetween,
  inPeriod,
  isOverdue,
  useAnalyticsRequests,
} from "@/hooks/useAnalyticsRequests";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2 } from "lucide-react";

function count(rows: AnalyticsRequest[], pred: (r: AnalyticsRequest) => boolean) {
  return rows.filter(pred).length;
}

export default function AnalyticsRequestsPage() {
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[1]);

  const rows = useMemo(() => data.filter((r) => inPeriod(r, period.from, period.to)), [data, period]);

  const metrics = useMemo(() => {
    const delivered = rows.filter((r) => StatusGroups.DELIVERED.has(r.status ?? ""));
    return {
      new: count(rows, (r) => (r.status ?? "") === "Новая заявка"),
      incoming: count(rows, (r) => (r.status ?? "") === "Входящая заявка"),
      inWork: count(
        rows,
        (r) =>
          !StatusGroups.DELIVERED.has(r.status ?? "") &&
          !StatusGroups.CANCELLED.has(r.status ?? "") &&
          !StatusGroups.IN_TRANSIT.has(r.status ?? "") &&
          !StatusGroups.NEW_STATUSES.has(r.status ?? ""),
      ),
      inTransit: count(rows, (r) => StatusGroups.IN_TRANSIT.has(r.status ?? "")),
      delivered: delivered.length,
      overdue: count(rows, isOverdue),
      emergency: count(rows, (r) => (r.priority ?? "").toLowerCase().includes("авар")),
      priority: count(rows, (r) => (r.priority ?? "").toLowerCase().includes("срочн")),
      planned: count(rows, (r) => (r.priority ?? "").toLowerCase().includes("план")),
      cancelled: count(rows, (r) => StatusGroups.CANCELLED.has(r.status ?? "")),
      avgCycle: avg(delivered.map((r) => daysBetween(r.created_at, r.actual_arrival_date))),
    };
  }, [rows]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; created: number; closed: number; overdue: number }>();
    for (const r of data) {
      const k = format(startOfMonth(new Date(r.created_at)), "yyyy-MM");
      const lbl = format(startOfMonth(new Date(r.created_at)), "LLL yy", { locale: ru });
      const b = map.get(k) ?? { month: lbl, created: 0, closed: 0, overdue: 0 };
      b.created += 1;
      if (StatusGroups.DELIVERED.has(r.status ?? "")) b.closed += 1;
      if (isOverdue(r)) b.overdue += 1;
      map.set(k, b);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1)).slice(-12).map(([, v]) => v);
  }, [data]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Аналитика · Заявки</h1>
        <p className="text-sm text-muted-foreground">Состояние всех заявок системы.</p>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Новые" value={metrics.new} to="/requests?status=Новая+заявка" />
        <MetricCard label="Входящие" value={metrics.incoming} to="/requests?status=Входящая+заявка" />
        <MetricCard label="В работе" value={metrics.inWork} />
        <MetricCard label="В пути" value={metrics.inTransit} to="/requests?status=В+пути" />
        <MetricCard label="Доставлены" value={metrics.delivered} tone="success" to="/requests?status=Доставлено" />
        <MetricCard label="Просрочены" value={metrics.overdue} tone="danger" />
        <MetricCard label="Аварийные" value={metrics.emergency} tone="danger" />
        <MetricCard label="Срочные" value={metrics.priority} tone="warning" />
        <MetricCard label="Плановые" value={metrics.planned} />
        <MetricCard label="Отменённые" value={metrics.cancelled} />
        <MetricCard
          label="Ср. время выполнения"
          value={metrics.avgCycle === null ? "—" : `${metrics.avgCycle.toFixed(1)} дн`}
        />
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-3">Динамика по месяцам</div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="created" name="Создано" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed" name="Закрыто" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="overdue" name="Просрочено" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
