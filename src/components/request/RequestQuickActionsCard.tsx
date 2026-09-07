import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Request } from "@/hooks/useRequests";

interface Status {
  id: string;
  name: string;
}

interface Priority {
  id: string;
  name: string;
}

interface RequestQuickActionsCardProps {
  request: Request;
  statuses: Status[] | undefined;
  priorities: Priority[] | undefined;
  canEdit: boolean;
  onUpdate: (updates: Partial<Request>) => void;
}

export function RequestQuickActionsCard({
  request,
  statuses,
  priorities,
  canEdit,
  onUpdate,
}: RequestQuickActionsCardProps) {
  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      "Новая заявка": "bg-muted text-muted-foreground border-border",
      "В работе": "bg-warning/15 text-warning dark:text-warning border-warning/30",
      "На согласовании": "bg-info/15 text-info border-info/30",
      "КП": "bg-info/15 text-info border-info/30",
      "Счёт": "bg-info/15 text-info border-info/30",
      "Счёт в бухгалтерии": "bg-info/15 text-info border-info/30",
      "Счёт в Бухгалтерии": "bg-info/15 text-info border-info/30",
      "Оплачено": "bg-info/15 text-info dark:text-info border-info/30",
      "Готов к отгрузке": "bg-warning/15 text-warning dark:text-warning border-warning/30",
      "В пути": "bg-success/15 text-success dark:text-success border-success/30",
      "Доставлено в ТК": "bg-success/15 text-success dark:text-success border-success/30",
      "Доставлено": "bg-success/15 text-success dark:text-success border-success/30",
      "Выполнено": "bg-success/15 text-success dark:text-success border-success/30",
    };
    return styles[status] || "";
  };

  const getPriorityStyle = (priority: string) => {
    const styles: Record<string, string> = {
      "Аварийно": "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30",
      "Приоритетно": "bg-warning/15 text-warning dark:text-warning border-warning/30",
      "Плановая": "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
    };
    return styles[priority] || "";
  };

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Быстрые действия
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Статус</p>
          {canEdit ? (
            <Select
              value={request.status}
              onValueChange={(value) => onUpdate({ status: value })}
            >
              <SelectTrigger className={cn(
                "w-full transition-colors",
                getStatusStyle(request.status)
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses?.map((status) => (
                  <SelectItem key={status.id} value={status.name}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        getStatusStyle(status.name).includes("blue") && "bg-info",
                        getStatusStyle(status.name).includes("amber") && "bg-warning",
                        getStatusStyle(status.name).includes("info") && "bg-info",
                        getStatusStyle(status.name).includes("indigo") && "bg-info",
                        getStatusStyle(status.name).includes("emerald") && "bg-success",
                        getStatusStyle(status.name).includes("green") && "bg-success",
                      )} />
                      {status.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge 
              variant="outline" 
              className={cn("w-full justify-center py-2", getStatusStyle(request.status))}
            >
              {request.status}
            </Badge>
          )}
        </div>

        <Separator className="bg-border/40" />

        {/* Priority */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Приоритет</p>
          {canEdit ? (
            <Select
              value={request.priority || ""}
              onValueChange={(value) => onUpdate({ priority: value })}
            >
              <SelectTrigger className={cn(
                "w-full transition-colors",
                getPriorityStyle(request.priority || "")
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities?.map((priority) => (
                  <SelectItem key={priority.id} value={priority.name}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        priority.name === "Аварийно" && "bg-destructive",
                        priority.name === "Приоритетно" && "bg-warning",
                        priority.name === "Плановая" && "bg-gray-400",
                      )} />
                      {priority.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge 
              variant="outline" 
              className={cn("w-full justify-center py-2", getPriorityStyle(request.priority || ""))}
            >
              {request.priority || "—"}
            </Badge>
          )}
        </div>

        <Separator className="bg-border/40" />

        {/* Quick comment */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            Примечание
          </p>
          {canEdit ? (
            <Textarea
              value={request.comments || ""}
              onChange={(e) => onUpdate({ comments: e.target.value || null })}
              placeholder="Добавить примечание..."
              className="min-h-[80px] text-sm resize-none"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {request.comments || "—"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
