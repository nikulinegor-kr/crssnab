import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopExecutorsWidgetProps {
  requests: Request[];
}

export function TopExecutorsWidget({ requests }: TopExecutorsWidgetProps) {
  const executorStats = requests.reduce((acc, request) => {
    if (request.executor) {
      acc[request.executor] = (acc[request.executor] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topExecutors = Object.entries(executorStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">
          Топ исполнителей
        </CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {topExecutors.length > 0 ? (
          <div className="space-y-2">
            {topExecutors.map(([executor, count], index) => (
              <div
                key={executor}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {executor}
                  </span>
                </div>
                <Badge variant="secondary" className="ml-2">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Нет данных об исполнителях
          </p>
        )}
      </CardContent>
    </Card>
  );
}
