import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { FileText, CheckCircle2, TrendingUp, Package, Clock } from "lucide-react";
import { UpcomingDeliveriesWidget } from "./dashboard/UpcomingDeliveriesWidget";

interface RequestsAnalyticsProps {
  requests: Request[];
  allRequests?: Request[]; // Все заявки для виджета поставок (без фильтра по году)
  onRequestClick?: (request: Request) => void;
}

export function RequestsAnalytics({ requests, allRequests, onRequestClick }: RequestsAnalyticsProps) {
  // Фильтрация заявок по текущему году для графика
  const currentYear = new Date().getFullYear();
  const currentYearRequests = requests.filter(req => {
    const requestYear = new Date(req.request_date).getFullYear();
    return requestYear === currentYear;
  });

  // Подготовка данных для графика по времени (данные за текущий год)
  const timelineData = currentYearRequests.reduce((acc, req) => {
    const month = new Date(req.request_date).toLocaleDateString("ru-RU", { 
      month: "short", 
      year: "2-digit" 
    });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ month, count: 1 });
    }
    return acc;
  }, [] as { month: string; count: number }[]);


  // Вычисление метрик
  const completedRequests = requests.filter(r => r.status === "Доставлено").length;
  const completionRate = requests.length > 0 ? ((completedRequests / requests.length) * 100).toFixed(1) : "0";
  
  const inProgressRequests = requests.filter(r => 
    r.status === "В работе" || r.status === "В пути"
  ).length;

  const emergencyRequests = requests.filter(r => r.priority === "Аварийно").length;

  const avgCompletionTime = "5.2"; // Можно вычислить на основе дат

  return (
    <div className="space-y-4">
      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* График заявок во времени */}
        <Card className="lg:col-span-2 bg-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Заявки во времени</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Динамика поступления заявок за последние 12 месяцев
            </p>
          </CardContent>
        </Card>

        {/* Ближайшие поставки ТМЦ */}
        <UpcomingDeliveriesWidget 
          requests={allRequests || requests} 
          onRequestClick={onRequestClick}
        />
      </div>

      {/* Дополнительные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Выполнено</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div className="text-xl font-bold">{completedRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">заявок</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">% выполнения</span>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="text-xl font-bold text-success">{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">от общего числа</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">В работе</span>
              <Package className="h-4 w-4 text-info" />
            </div>
            <div className="text-xl font-bold">{inProgressRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">заявок</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Аварийные</span>
              <FileText className="h-4 w-4 text-accent" />
            </div>
            <div className="text-xl font-bold text-accent">{emergencyRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">заявок</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Ср. время</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl font-bold">{avgCompletionTime}</div>
            <p className="text-xs text-muted-foreground mt-1">дней</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Всего</span>
              <FileText className="h-4 w-4 text-foreground" />
            </div>
            <div className="text-xl font-bold">{requests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">заявок</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
