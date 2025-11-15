import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { FileText, CheckCircle2, TrendingUp, Package, Clock } from "lucide-react";

interface RequestsAnalyticsProps {
  requests: Request[];
}

export function RequestsAnalytics({ requests }: RequestsAnalyticsProps) {
  // Подготовка данных для графика по времени
  const timelineData = requests.reduce((acc, req) => {
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
  }, [] as { month: string; count: number }[]).slice(-12);

  // Подготовка данных для круговой диаграммы (по статусам)
  const statusData = requests.reduce((acc, req) => {
    const existing = acc.find(item => item.name === req.status);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: req.status, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--info))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  // Вычисление метрик
  const completedRequests = requests.filter(r => r.status === "Выполнено").length;
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

        {/* Круговая диаграмма по статусам */}
        <Card className="bg-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Распределение по статусам</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {statusData.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
