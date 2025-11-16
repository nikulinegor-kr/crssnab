import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle } from "lucide-react";

interface RequestSettingsProps {
  organizationId: string;
}

export const RequestSettings = ({ organizationId }: RequestSettingsProps) => {
  const statuses = [
    "Новая заявка",
    "В работе",
    "Ожидание оплаты",
    "Оплачена",
    "Отгружена",
    "Доставлена",
    "Выполнена",
    "Отменена",
  ];

  const priorities = ["Планово", "Срочно", "Авария"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Статусы заявок</CardTitle>
          </div>
          <CardDescription>
            Доступные статусы для заявок в системе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Badge key={status} variant="outline">
                {status}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle>Приоритеты заявок</CardTitle>
          </div>
          <CardDescription>
            Доступные приоритеты для заявок в системе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {priorities.map((priority) => (
              <Badge 
                key={priority} 
                variant={
                  priority === "Авария" 
                    ? "destructive" 
                    : priority === "Срочно" 
                    ? "default" 
                    : "secondary"
                }
              >
                {priority}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Настройка кастомных статусов и приоритетов будет доступна в следующих версиях
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
