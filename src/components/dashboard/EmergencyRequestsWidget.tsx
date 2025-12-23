import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Request } from "@/hooks/useRequests";
import { AlertTriangle, FileText } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface EmergencyRequestsWidgetProps {
  requests: Request[];
  onRequestClick: (request: Request) => void;
}

export function EmergencyRequestsWidget({ requests, onRequestClick }: EmergencyRequestsWidgetProps) {
  const emergencyRequests = requests
    .filter(r => r.priority === "Аварийно" && r.status !== "Доставлено")
    .sort((a, b) => new Date(b.request_date).getTime() - new Date(a.request_date).getTime())
    .slice(0, 5);

  return (
    <Card className="bg-card border-border/40 border-l-4 border-l-destructive">
      <CardHeader className="border-b border-border/40 bg-destructive/5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
          Аварийные заявки
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {emergencyRequests.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Нет аварийных заявок
          </div>
        ) : (
          <div className="space-y-3">
            {emergencyRequests.map((request) => (
              <div
                key={request.id}
                onClick={() => onRequestClick(request)}
                className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-all cursor-pointer group"
              >
                <div className="p-2 rounded bg-destructive/20 group-hover:bg-destructive/30 transition-colors">
                  <FileText className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {request.request_number}
                    </p>
                    <Badge variant="destructive" className="text-xs max-w-[120px] truncate shrink-0">
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {request.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(request.request_date), "d MMM", { locale: ru })}
                    </span>
                    {request.executor && (
                      <span className="truncate">
                        Исп.: {request.executor}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
