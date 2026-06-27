import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/analytics/MetricCard";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import {
  AnalyticsRequest,
  inPeriod,
  totalAmount,
  useAnalyticsRequests,
} from "@/hooks/useAnalyticsRequests";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAID = new Set(["Оплачен", "Оплачено"]);

export default function AnalyticsFinancePage() {
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);

  const rows = useMemo(
    () => data.filter((r) => inPeriod(r, period.from, period.to)),
    [data, period],
  );

  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; amount: number }>();
    for (const r of rows) {
      const k = format(startOfMonth(new Date(r.created_at)), "yyyy-MM");
      const lbl = format(startOfMonth(new Date(r.created_at)), "LLL yy", { locale: ru });
      const b = m.get(k) ?? { month: lbl, amount: 0 };
      b.amount += totalAmount(r);
      m.set(k, b);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1)).map(([, v]) => ({ ...v, amount: Math.round(v.amount) }));
  }, [rows]);

  const byContractor = useMemo(() => aggregate(rows, (r) => r.contractor ?? "Без контрагента"), [rows]);
  const total = rows.reduce((s, r) => s + totalAmount(r), 0);
  const withAmount = rows.filter((r) => totalAmount(r) > 0);
  const avgInvoice = withAmount.length ? total / withAmount.length : 0;

  const unpaid = rows
    .filter((r) => r.invoice_number && !PAID.has(r.payment_status ?? ""))
    .sort((a, b) => totalAmount(b) - totalAmount(a))
    .slice(0, 50);
  const overdue = unpaid.filter((r) => r.invoice_date && Date.now() - new Date(r.invoice_date).getTime() > 30 * 86400000);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Аналитика · Финансы</h1>
        <p className="text-sm text-muted-foreground">Расходы, поставщики, оплаты.</p>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Сумма закупок" value={`${Math.round(total).toLocaleString("ru-RU")} ₽`} />
        <MetricCard label="Средний чек" value={`${Math.round(avgInvoice).toLocaleString("ru-RU")} ₽`} />
        <MetricCard label="Неоплаченные счета" value={unpaid.length} tone="warning" />
        <MetricCard label="Просроченные оплаты" value={overdue.length} tone="danger" />
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-3">Расходы по месяцам</div>
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

      <Tabs defaultValue="contractor">
        <TabsList>
          <TabsTrigger value="contractor">Топ поставщиков</TabsTrigger>
          <TabsTrigger value="unpaid">Неоплаченные счета</TabsTrigger>
          <TabsTrigger value="overdue">Просроченные</TabsTrigger>
        </TabsList>
        <TabsContent value="contractor">
          <Card className="p-4">
            <div className="space-y-2">
              {byContractor.slice(0, 10).map((row) => (
                <div key={row.key} className="flex items-center justify-between text-sm">
                  <div className="truncate">{row.key}</div>
                  <div className="font-numeric">{Math.round(row.amount).toLocaleString("ru-RU")} ₽</div>
                </div>
              ))}
              {!byContractor.length && <div className="text-muted-foreground text-sm">Нет данных</div>}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="unpaid">
          <InvoiceList rows={unpaid} />
        </TabsContent>
        <TabsContent value="overdue">
          <InvoiceList rows={overdue} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function aggregate(rows: AnalyticsRequest[], keyFn: (r: AnalyticsRequest) => string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) ?? 0) + totalAmount(r));
  }
  return Array.from(m.entries()).map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);
}

function InvoiceList({ rows }: { rows: AnalyticsRequest[] }) {
  return (
    <Card className="p-2">
      <div className="divide-y">
        {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">Нет записей</div>}
        {rows.map((r) => (
          <Link key={r.id} to={`/requests/${r.id}`} className="block px-3 py-2 hover:bg-muted/40">
            <div className="flex items-center justify-between text-sm">
              <div className="truncate">{r.description ?? "—"}</div>
              <div className="font-numeric whitespace-nowrap pl-3">
                {Math.round(totalAmount(r)).toLocaleString("ru-RU")} ₽
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {r.contractor ?? "—"} · счёт {r.invoice_number ?? "—"} · {r.payment_status ?? "—"}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
