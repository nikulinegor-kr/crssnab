import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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

export const ExpenseChart = ({ requests, selectedYear }: ExpenseChartProps) => {
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

  const totalAmount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.amount, 0);
  }, [data]);

  const avgMonthly = useMemo(() => {
    const nonZeroMonths = data.filter(d => d.amount > 0).length;
    return nonZeroMonths > 0 ? totalAmount / nonZeroMonths : 0;
  }, [data, totalAmount]);

  // Calculate trend (compare last 3 months to previous 3 months)
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{label} {selectedYear}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Сумма: <span className="font-semibold text-primary">
              {new Intl.NumberFormat("ru-RU", { 
                style: "currency", 
                currency: "RUB",
                maximumFractionDigits: 0 
              }).format(payload[0].value)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Заявок: {payload[0].payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Расходы по месяцам</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-muted-foreground">Всего за год</p>
              <p className="font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="text-right">
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
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
  );
};
