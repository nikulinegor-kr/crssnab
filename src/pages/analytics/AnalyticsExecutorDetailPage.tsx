import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import { MetricCard } from "@/components/analytics/MetricCard";
import {
  AnalyticsRequest,
  StatusGroups,
  avg,
  daysBetween,
  inPeriod,
  isOverdue,
  totalAmount,
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

export default function AnalyticsExecutorDetailPage() {
  const { executor: enc } = useParams();
  const executor = decodeURIComponent(enc ?? "");
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);

  const mine = useMemo(
    () => data.filter((r) => (r.executor ?? "") === executor),
    [data, executor],
  );

  const inPeriodRows = useMemo(
    () => mine.filter((r) => inPeriod(r, period.from, period.to)),
    [mine, period],
  );

  const kpi = useMemo(() => {
    const delivered = inPeriodRows.filter((r) => StatusGroups.DELIVERED.has(r.status ?? ""));
    const overdue = inPeriodRows.filter(isOverdue).length;
    const amount = inPeriodRows.reduce((s, r) => s + totalAmount(r), 0);
    const avgCycle = avg(delivered.map((r) => daysBetween(r.created_at, r.actual_arrival_date)));
    return {
      total: inPeriodRows.length,
      delivered: delivered.length,
      overdue,
      amount,
      avgCycle,
    };
  }, [inPeriodRows]);

  const monthly = useMemo(() => {
    const buckets = new Map<string, { month: string; total: number; delivered: number; amount: number; cycle: (number | null)[] }>();
    for (const r of mine) {
      const key = format(startOfMonth(new Date(r.created_at)), "yyyy-MM");
      const lbl = format(startOfMonth(new Date(r.created_at)), "LLL yy", { locale: ru });
      const b = buckets.get(key) ?? { month: lbl, total: 0, delivered: 0, amount: 0, cycle: [] };
      b.total += 1;
      if (StatusGroups.DELIVERED.has(r.status ?? "")) {
        b.delivered += 1;
        b.cycle.push(daysBetween(r.created_at, r.actual_arrival_date));
      }
      b.amount += totalAmount(r);
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .slice(-12)
      .map(([, v]) => ({ month: v.month, total: v.total, delivered: v.delivered, amount: Math.round(v.amount), cycle: avg(v.cycle) ?? 0 }));
  }, [mine]);

  const current = inPeriodRows.filter(
    (r) => !StatusGroups.DELIVERED.has(r.status ?? "") && !StatusGroups.CANCELLED.has(r.status ?? ""),
  ).slice(0, 50);
  const history = inPeriodRows.filter((r) => StatusGroups.DELIVERED.has(r.status ?? "")).slice(0, 50);

  if (loading)
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link to="/analytics/executors">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> К списку
          </Button>
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{executor}</h1>
          <p className="text-sm text-muted-foreground">Детальная аналитика сотрудника</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Всего заявок" value={kpi.total} />
        <MetricCard label="Выполнено" value={kpi.delivered} tone="success" />
        <MetricCard label="Просрочено" value={kpi.overdue} tone="danger" />
        <MetricCard label="Ср. цикл" value={kpi.avgCycle === null ? "—" : `${kpi.avgCycle.toFixed(1)} дн`} />
        <MetricCard label="Сумма закупок" value={`${Math.round(kpi.amount).toLocaleString("ru-RU")} ₽`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Эффективность по месяцам</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="total" name="Создано" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Выполнено" fill="hsl(var(--chart-2, 142 76% 36%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Скорость выполнения (дни)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="cycle" name="Ср. цикл" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-3">Суммы закупок по месяцам</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `${v.toLocaleString("ru-RU")} ₽`} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RequestListCard title="Текущие заявки" rows={current} />
        <RequestListCard title="История выполненных" rows={history} />
      </div>
    </div>
  );
}

function RequestListCard({ title, rows }: { title: string; rows: AnalyticsRequest[] }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      <div className="space-y-1.5 max-h-96 overflow-auto">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Нет заявок</div>}
        {rows.map((r) => (
          <Link
            key={r.id}
            to={`/requests/${r.id}`}
            className="block rounded px-2 py-1.5 hover:bg-muted/40 text-sm"
          >
            <div className="truncate">{r.description ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {r.status ?? "—"} · {totalAmount(r).toLocaleString("ru-RU")} ₽
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
