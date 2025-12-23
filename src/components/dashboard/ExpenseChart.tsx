import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Request } from "@/hooks/useRequests";

interface ExpenseChartProps {
  requests: Request[];
  selectedYear: string;
}

const monthNames = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
];

const fullMonthNames = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export const ExpenseChart = ({ requests, selectedYear }: ExpenseChartProps) => {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const data = useMemo(() => {
    const monthlyData = Array(12).fill(0).map((_, index) => ({
      month: monthNames[index],
      monthIndex: index,
      amount: 0,
      count: 0,
    }));

    requests.forEach((request) => {
      if (!request.request_date) return;
      
      const date = new Date(request.request_date);
      if (date.getFullYear().toString() !== selectedYear) return;
      
      const month = date.getMonth();
      const amount = request.amount || 0;
      
      monthlyData[month].amount += Number(amount);
      monthlyData[month].count += 1;
    });

    return monthlyData;
  }, [requests, selectedYear]);

  const monthRequests = useMemo(() => {
    if (selectedMonth === null) return [];
    
    return requests
      .filter((request) => {
        if (!request.request_date) return false;
        const date = new Date(request.request_date);
        return date.getFullYear().toString() === selectedYear && date.getMonth() === selectedMonth;
      })
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [requests, selectedYear, selectedMonth]);

  const totalAmount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.amount, 0);
  }, [data]);

  const avgMonthly = useMemo(() => {
    const nonZeroMonths = data.filter(d => d.amount > 0).length;
    return nonZeroMonths > 0 ? totalAmount / nonZeroMonths : 0;
  }, [data, totalAmount]);

  const trend = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const lastThreeMonths = data
      .slice(Math.max(0, currentMonth - 2), currentMonth + 1)
      .reduce((sum, d) => sum + d.amount, 0);
    const prevThreeMonths = data
      .slice(Math.max(0, currentMonth - 5), Math.max(0, currentMonth - 2))
      .reduce((sum, d) => sum + d.amount, 0);
    
    if (prevThreeMonths === 0) return 0;
    return ((lastThreeMonths - prevThreeMonths) / prevThreeMonths) * 100;
  }, [data]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ₽`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K ₽`;
    }
    return `${value.toFixed(0)} ₽`;
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", { 
      style: "currency", 
      currency: "RUB",
      maximumFractionDigits: 0 
    }).format(value);
  };

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      setSelectedMonth(data.activePayload[0].payload.monthIndex);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{label} {selectedYear}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Сумма: <span className="font-semibold text-primary">
              {formatFullCurrency(payload[0].value)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Заявок: {payload[0].payload.count}
          </p>
          <p className="text-xs text-muted-foreground mt-1 italic">
            Нажмите для детализации
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Расходы по месяцам</CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="text-left sm:text-right">
                <p className="text-muted-foreground">Всего за год</p>
                <p className="font-bold text-foreground">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-muted-foreground">Средняя/мес</p>
                <p className="font-bold text-foreground">{formatCurrency(avgMonthly)}</p>
              </div>
              <div className="flex items-center gap-1">
                {trend > 5 ? (
                  <TrendingUp className="h-4 w-4 text-destructive" />
                ) : trend < -5 ? (
                  <TrendingDown className="h-4 w-4 text-success" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={`text-sm font-medium ${
                  trend > 5 ? "text-destructive" : trend < -5 ? "text-success" : "text-muted-foreground"
                }`}>
                  {Math.abs(trend).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={handleBarClick}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                <Bar 
                  dataKey="amount" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Сумма расходов"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedMonth !== null} onOpenChange={() => setSelectedMonth(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Расходы за {selectedMonth !== null ? fullMonthNames[selectedMonth] : ""} {selectedYear}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Всего заявок: {monthRequests.length}
            </p>
            <p className="text-lg font-bold">
              Итого: {formatFullCurrency(monthRequests.reduce((sum, r) => sum + (r.amount || 0), 0))}
            </p>
          </div>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№ Заявки</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.request_number}</TableCell>
                    <TableCell>
                      {new Date(request.request_date).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.description}
                    </TableCell>
                    <TableCell>{request.contractor || "—"}</TableCell>
                    <TableCell>{request.status}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFullCurrency(request.amount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {monthRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Нет заявок за этот месяц
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};