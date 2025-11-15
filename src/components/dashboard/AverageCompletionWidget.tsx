import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { Clock } from "lucide-react";

interface AverageCompletionWidgetProps {
  requests: Request[];
}

export function AverageCompletionWidget({ requests }: AverageCompletionWidgetProps) {
  const completedRequests = requests.filter(
    (r) => r.status === "Доставлено" && r.delivery_date
  );

  const calculateAverageDays = () => {
    if (completedRequests.length === 0) return 0;

    const totalDays = completedRequests.reduce((sum, request) => {
      const startDate = new Date(request.request_date);
      const endDate = new Date(request.delivery_date!);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);

    return (totalDays / completedRequests.length).toFixed(1);
  };

  const avgDays = calculateAverageDays();

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Средний срок выполнения
        </CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{avgDays} дней</div>
        <p className="text-xs text-muted-foreground mt-1">
          На основе {completedRequests.length} завершенных заявок
        </p>
      </CardContent>
    </Card>
  );
}
