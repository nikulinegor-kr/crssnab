import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
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
import { Loader2 } from "lucide-react";

type Row = {
  executor: string;
  total: number;
  newCount: number;
  inWork: number;
  delivered: number;
  overdue: number;
  onTimePct: number;
  avgCycle: number | null;
  avgInvoice: number | null;
  avgPayment: number | null;
  avgShipment: number | null;
  avgDelivery: number | null;
  emergency: number;
  priority: number;
  planned: number;
  amount: number;
  score: number;
};

function buildRow(executor: string, requests: AnalyticsRequest[]): Row {
  const delivered = requests.filter((r) => StatusGroups.DELIVERED.has(r.status ?? ""));
  const inWork = requests.filter(
    (r) =>
      !StatusGroups.DELIVERED.has(r.status ?? "") &&
      !StatusGroups.CANCELLED.has(r.status ?? "") &&
      !StatusGroups.NEW_STATUSES.has(r.status ?? ""),
  );
  const newC = requests.filter((r) => StatusGroups.NEW_STATUSES.has(r.status ?? "")).length;
  const overdue = requests.filter(isOverdue).length;
  const onTimeDelivered = delivered.filter((r) => {
    const target = r.delivery_date ?? r.planned_delivery_date;
    if (!target || !r.actual_arrival_date) return true;
    return new Date(r.actual_arrival_date).getTime() <= new Date(target).getTime() + 86400000;
  }).length;

  const avgCycle = avg(delivered.map((r) => daysBetween(r.created_at, r.actual_arrival_date)));
  const avgInvoice = avg(requests.map((r) => daysBetween(r.created_at, r.invoice_date)));
  const avgPayment = avg(
    requests
      .filter((r) => r.payment_status === "Оплачен" || r.payment_status === "Оплачено")
      .map((r) => daysBetween(r.invoice_date, r.updated_at)),
  );
  const avgShipment = avg(requests.map((r) => daysBetween(r.created_at, r.shipment_date)));
  const avgDelivery = avg(requests.map((r) => daysBetween(r.shipment_date, r.actual_arrival_date)));

  const onTimePct = delivered.length ? Math.round((onTimeDelivered / delivered.length) * 100) : 0;
  const amount = requests.reduce((s, r) => s + totalAmount(r), 0);
  const emergency = requests.filter((r) => (r.priority ?? "").toLowerCase().includes("авар")).length;
  const priority = requests.filter((r) => (r.priority ?? "").toLowerCase().includes("срочн")).length;
  const planned = requests.filter((r) => (r.priority ?? "").toLowerCase().includes("план")).length;

  // composite score (0-100)
  const speedScore = avgCycle ? Math.max(0, 100 - avgCycle * 2) : 50;
  const score = Math.round(0.5 * onTimePct + 0.3 * speedScore + 0.2 * Math.min(100, delivered.length * 5));

  return {
    executor,
    total: requests.length,
    newCount: newC,
    inWork: inWork.length,
    delivered: delivered.length,
    overdue,
    onTimePct,
    avgCycle,
    avgInvoice,
    avgPayment,
    avgShipment,
    avgDelivery,
    emergency,
    priority,
    planned,
    amount,
    score,
  };
}

const fmtNum = (n: number) => n.toLocaleString("ru-RU");
const fmtAmount = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const fmtDays = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} дн`);

export default function AnalyticsExecutorsPage() {
  const { data, loading } = useAnalyticsRequests();
  const [period, setPeriod] = useState<Period>(presetPeriods()[1]);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const filtered = data.filter((r) => inPeriod(r, period.from, period.to));
    const byExec = new Map<string, AnalyticsRequest[]>();
    for (const r of filtered) {
      const ex = (r.executor ?? "").trim();
      if (!ex) continue;
      if (!byExec.has(ex)) byExec.set(ex, []);
      byExec.get(ex)!.push(r);
    }
    const arr = Array.from(byExec.entries()).map(([ex, list]) => buildRow(ex, list));
    arr.sort((a, b) => b.score - a.score);
    return arr.filter((r) => r.executor.toLowerCase().includes(q.toLowerCase()));
  }, [data, period, q]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Аналитика · Исполнители</h1>
        <p className="text-sm text-muted-foreground">
          Производительность сотрудников по заявкам за выбранный период.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <PeriodFilter value={period} onChange={setPeriod} />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск исполнителя…"
          className="max-w-xs"
        />
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Исполнитель</TableHead>
                  <TableHead className="text-right">Новые</TableHead>
                  <TableHead className="text-right">В работе</TableHead>
                  <TableHead className="text-right">Выполнено</TableHead>
                  <TableHead className="text-right">Просрочено</TableHead>
                  <TableHead className="text-right">% в срок</TableHead>
                  <TableHead className="text-right">Ср. цикл</TableHead>
                  <TableHead className="text-right">Ср. счёт</TableHead>
                  <TableHead className="text-right">Ср. оплата</TableHead>
                  <TableHead className="text-right">Ср. отгрузка</TableHead>
                  <TableHead className="text-right">Ср. доставка</TableHead>
                  <TableHead className="text-right">Авар.</TableHead>
                  <TableHead className="text-right">Срочн.</TableHead>
                  <TableHead className="text-right">Планов.</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Рейтинг</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const enc = encodeURIComponent(r.executor);
                  return (
                    <TableRow key={r.executor} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-background font-medium">
                        <Link
                          to={`/analytics/executors/${enc}`}
                          className="text-primary hover:underline"
                        >
                          {r.executor}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.newCount)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.inWork)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.delivered)}</TableCell>
                      <TableCell className="text-right font-numeric text-destructive">{fmtNum(r.overdue)}</TableCell>
                      <TableCell className="text-right font-numeric">{r.onTimePct}%</TableCell>
                      <TableCell className="text-right font-numeric">{fmtDays(r.avgCycle)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtDays(r.avgInvoice)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtDays(r.avgPayment)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtDays(r.avgShipment)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtDays(r.avgDelivery)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.emergency)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.priority)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtNum(r.planned)}</TableCell>
                      <TableCell className="text-right font-numeric">{fmtAmount(r.amount)}</TableCell>
                      <TableCell className="text-right font-numeric font-semibold">{r.score}</TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center text-muted-foreground py-10">
                      Нет данных за выбранный период
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
