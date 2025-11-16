import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Request } from "@/hooks/useRequests";
import { AlertTriangle } from "lucide-react";

interface EmergencyInProgressWidgetProps {
  requests: Request[];
  onClick?: () => void;
}

export function EmergencyInProgressWidget({ requests, onClick }: EmergencyInProgressWidgetProps) {
  const emergencyInProgress = requests.filter(
    r => r.priority === "Аварийно" && r.status !== "Доставлено"
  ).length;

  return (
    <Card 
      className="bg-card border-border/40 shadow-sm border-l-4 border-l-destructive hover:shadow-md transition-all duration-200 cursor-pointer hover:border-destructive/70"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 bg-destructive/5">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Аварийные в работе
        </CardTitle>
        <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
      </CardHeader>
      <CardContent className="pt-6">
        <div className="text-4xl font-bold text-destructive mb-1">
          {emergencyInProgress}
        </div>
        <p className="text-xs text-muted-foreground">
          Заявок с приоритетом "Аварийно" без статуса "Доставлено"
        </p>
      </CardContent>
    </Card>
  );
}
