import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { Trophy, User, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopPerformersWidgetProps {
  requests: Request[];
}

export function TopPerformersWidget({ requests }: TopPerformersWidgetProps) {
  // Подсчет выполненных заявок по исполнителям
  const performersStats = requests
    .filter(r => r.executor && r.status === "Доставлено")
    .reduce((acc, req) => {
      const executor = req.executor!;
      if (!acc[executor]) {
        acc[executor] = { name: executor, completed: 0, total: 0 };
      }
      acc[executor].completed += 1;
      return acc;
    }, {} as Record<string, { name: string; completed: number; total: number }>);

  // Подсчет всех заявок по исполнителям
  requests
    .filter(r => r.executor)
    .forEach(req => {
      const executor = req.executor!;
      if (performersStats[executor]) {
        performersStats[executor].total += 1;
      }
    });

  const topPerformers = Object.values(performersStats)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getSuccessRate = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Топ исполнителей
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {topPerformers.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Нет данных об исполнителях
          </div>
        ) : (
          <div className="space-y-3">
            {topPerformers.map((performer, index) => {
              const successRate = getSuccessRate(performer.completed, performer.total);
              
              return (
                <div
                  key={performer.name}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-all"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(performer.name)}
                      </AvatarFallback>
                    </Avatar>
                    {index === 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                        <Trophy className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {performer.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success transition-all"
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {successRate}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{performer.completed}</p>
                    <p className="text-xs text-muted-foreground">выполнено</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
