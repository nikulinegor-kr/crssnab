import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { Clock, TrendingDown, TrendingUp, Timer, Award, AlertTriangle } from "lucide-react";
import { differenceInDays, differenceInHours, format, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";

interface Request {
  id: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  delivery_date: string | null;
  applicant: string | null;
  executor: string | null;
  contractor: string | null;
}

interface ClosureTimeAnalyticsProps {
  requests: Request[];
}

export function ClosureTimeAnalytics({ requests }: ClosureTimeAnalyticsProps) {
  // Фильтруем только закрытые заявки (Доставлено)
  const closedRequests = useMemo(() => 
    requests.filter(r => r.status === "Доставлено" && r.created_at && r.updated_at),
    [requests]
  );

  // Расчёт времени закрытия для каждой заявки
  const requestsWithClosureTime = useMemo(() => 
    closedRequests.map(r => ({
      ...r,
      closureTimeHours: differenceInHours(new Date(r.updated_at), new Date(r.created_at)),
      closureTimeDays: differenceInDays(new Date(r.updated_at), new Date(r.created_at)) || 1
    })),
    [closedRequests]
  );

  // Среднее время закрытия по приоритетам
  const avgByPriority = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    requestsWithClosureTime.forEach(r => {
      if (!grouped[r.priority]) grouped[r.priority] = [];
      grouped[r.priority].push(r.closureTimeDays);
    });
    
    return Object.entries(grouped).map(([priority, times]) => ({
      priority,
      avgDays: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)),
      count: times.length
    })).sort((a, b) => a.avgDays - b.avgDays);
  }, [requestsWithClosureTime]);

  // Среднее время закрытия по исполнителям
  const avgByExecutor = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    requestsWithClosureTime.forEach(r => {
      const executor = r.executor || "Не назначен";
      if (!grouped[executor]) grouped[executor] = [];
      grouped[executor].push(r.closureTimeDays);
    });
    
    return Object.entries(grouped)
      .map(([executor, times]) => ({
        executor: executor.length > 15 ? executor.slice(0, 15) + "..." : executor,
        fullName: executor,
        avgDays: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)),
        count: times.length
      }))
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, 10);
  }, [requestsWithClosureTime]);

  // Тренд по месяцам за последние 6 месяцев
  const monthlyTrend = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = startOfMonth(subMonths(new Date(), i - 1));
      
      const monthRequests = requestsWithClosureTime.filter(r => {
        const closedDate = new Date(r.updated_at);
        return closedDate >= monthStart && closedDate < monthEnd;
      });
      
      const avgDays = monthRequests.length > 0
        ? Number((monthRequests.reduce((a, b) => a + b.closureTimeDays, 0) / monthRequests.length).toFixed(1))
        : 0;
      
      months.push({
        month: format(monthStart, "MMM", { locale: ru }),
        avgDays,
        count: monthRequests.length
      });
    }
    return months;
  }, [requestsWithClosureTime]);

  // Общая статистика
  const stats = useMemo(() => {
    if (requestsWithClosureTime.length === 0) {
      return { avgDays: 0, minDays: 0, maxDays: 0, totalClosed: 0 };
    }
    
    const times = requestsWithClosureTime.map(r => r.closureTimeDays);
    return {
      avgDays: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)),
      minDays: Math.min(...times),
      maxDays: Math.max(...times),
      totalClosed: times.length
    };
  }, [requestsWithClosureTime]);

  // Распределение по времени закрытия
  const distributionData = useMemo(() => {
    const distribution = [
      { range: "< 1 дня", count: 0, color: "hsl(var(--success))" },
      { range: "1-3 дня", count: 0, color: "hsl(142 76% 46%)" },
      { range: "4-7 дней", count: 0, color: "hsl(var(--warning))" },
      { range: "8-14 дней", count: 0, color: "hsl(var(--accent))" },
      { range: "> 14 дней", count: 0, color: "hsl(var(--destructive))" }
    ];
    
    requestsWithClosureTime.forEach(r => {
      if (r.closureTimeDays < 1) distribution[0].count++;
      else if (r.closureTimeDays <= 3) distribution[1].count++;
      else if (r.closureTimeDays <= 7) distribution[2].count++;
      else if (r.closureTimeDays <= 14) distribution[3].count++;
      else distribution[4].count++;
    });
    
    return distribution.filter(d => d.count > 0);
  }, [requestsWithClosureTime]);

  const priorityColors: Record<string, string> = {
    "Аварийно": "hsl(0 84% 60%)",
    "Срочно": "hsl(25 95% 53%)",
    "Высокий": "hsl(48 96% 53%)",
    "Средний": "hsl(217 91% 60%)",
    "Низкий": "hsl(142 76% 46%)",
    "Планово": "hsl(215 14% 53%)"
  };

  if (closedRequests.length === 0) {
    return (
      <Card className="bg-card border-border/40">
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Нет данных о закрытых заявках</p>
          <p className="text-xs text-muted-foreground mt-2">
            Аналитика появится после завершения первых заявок
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Общая статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Среднее время</span>
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.avgDays}</div>
            <p className="text-xs text-muted-foreground">дней на закрытие</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Лучший результат</span>
              <Award className="h-4 w-4 text-success" />
            </div>
            <div className="text-2xl font-bold text-success">{stats.minDays}</div>
            <p className="text-xs text-muted-foreground">дней минимум</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Максимальное</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="text-2xl font-bold text-destructive">{stats.maxDays}</div>
            <p className="text-xs text-muted-foreground">дней максимум</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Закрыто всего</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats.totalClosed}</div>
            <p className="text-xs text-muted-foreground">заявок</p>
          </CardContent>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* По приоритетам */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Среднее время по приоритетам (от создания заявки до её закрытия)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgByPriority} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  dataKey="priority" 
                  type="category" 
                  tick={{ fontSize: 11 }} 
                  width={80}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value} дней`, "Среднее"]}
                />
                <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                  {avgByPriority.map((entry, index) => (
                    <Cell key={index} fill={priorityColors[entry.priority] || "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Распределение */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Распределение по времени
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="range"
                    label={({ range, percent }) => `${range}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value} заявок`, "Количество"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {distributionData.map((item, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-xs"
                  style={{ borderColor: item.color, color: item.color }}
                >
                  {item.range}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Тренд и исполнители */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Тренд по месяцам */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Тренд за 6 месяцев
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [
                    name === "avgDays" ? `${value} дней` : `${value} шт.`,
                    name === "avgDays" ? "Среднее время" : "Закрыто"
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgDays" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Среднее время закрытия в днях
            </p>
          </CardContent>
        </Card>

        {/* По исполнителям */}
        <Card className="bg-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4" />
              Рейтинг исполнителей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {avgByExecutor.map((item, index) => (
                <div 
                  key={item.executor} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                      index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                      index === 1 ? "bg-slate-400/20 text-slate-400" :
                      index === 2 ? "bg-amber-700/20 text-amber-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-sm truncate" title={item.fullName}>
                      {item.executor}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {item.count} шт.
                    </Badge>
                    <span className={`text-sm font-semibold ${
                      item.avgDays <= 3 ? "text-success" :
                      item.avgDays <= 7 ? "text-warning" :
                      "text-destructive"
                    }`}>
                      {item.avgDays} дн.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
