import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

interface ProgressWidgetProps {
  requests: Request[];
}

export function ProgressWidget({ requests }: ProgressWidgetProps) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Заявки текущего месяца
  const currentMonthRequests = requests.filter(r => {
    const date = new Date(r.request_date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const completedThisMonth = currentMonthRequests.filter(r => r.status === "Доставлено").length;
  const totalThisMonth = currentMonthRequests.length;
  const completionRate = totalThisMonth > 0 ? Math.round((completedThisMonth / totalThisMonth) * 100) : 0;

  // Предыдущий месяц для сравнения
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthRequests = requests.filter(r => {
    const date = new Date(r.request_date);
    return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
  });

  const completedPrevMonth = prevMonthRequests.filter(r => r.status === "Доставлено").length;
  const totalPrevMonth = prevMonthRequests.length;
  const prevCompletionRate = totalPrevMonth > 0 ? Math.round((completedPrevMonth / totalPrevMonth) * 100) : 0;

  const change = completionRate - prevCompletionRate;
  const isPositive = change >= 0;

  // Цель на месяц (например, 80%)
  const monthlyGoal = 80;
  const goalProgress = Math.min((completionRate / monthlyGoal) * 100, 100);

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Прогресс выполнения
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Основной прогресс */}
          <div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-3xl font-bold text-foreground">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">выполнено в этом месяце</p>
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(change)}%
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Цель месяца */}
          <div className="pt-4 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Цель на месяц: {monthlyGoal}%</p>
              <p className="text-sm font-medium text-foreground">{Math.round(goalProgress)}%</p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  goalProgress >= 100 ? "bg-success" : "bg-accent"
                }`}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
            <div>
              <p className="text-2xl font-bold text-foreground">{completedThisMonth}</p>
              <p className="text-xs text-muted-foreground">выполнено</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalThisMonth}</p>
              <p className="text-xs text-muted-foreground">всего</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
