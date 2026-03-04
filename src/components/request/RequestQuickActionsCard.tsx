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
      "Новая заявка": "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
      "В работе": "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
      "На согласовании": "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
      "КП": "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
      "Счёт": "bg-violet-400/15 text-violet-500 dark:text-violet-400 border-violet-400/30",
      "Счёт в бухгалтерии": "bg-violet-400/15 text-violet-500 dark:text-violet-400 border-violet-400/30",
      "Счёт в Бухгалтерии": "bg-violet-400/15 text-violet-500 dark:text-violet-400 border-violet-400/30",
      "Оплачено": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
      "Готов к отгрузке": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      "В пути": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
      "Доставлено в ТК": "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30",
      "Доставлено": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      "Выполнено": "bg-green-700/15 text-green-800 dark:text-green-300 border-green-700/30",
    };
    return styles[status] || "";
  };

  const getPriorityStyle = (priority: string) => {
    const styles: Record<string, string> = {
      "Аварийно": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
      "Приоритетно": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
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
                        getStatusStyle(status.name).includes("blue") && "bg-blue-500",
                        getStatusStyle(status.name).includes("amber") && "bg-amber-500",
                        getStatusStyle(status.name).includes("purple") && "bg-purple-500",
                        getStatusStyle(status.name).includes("indigo") && "bg-indigo-500",
                        getStatusStyle(status.name).includes("emerald") && "bg-emerald-500",
                        getStatusStyle(status.name).includes("green") && "bg-green-600",
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
                        priority.name === "Аварийно" && "bg-red-500",
                        priority.name === "Приоритетно" && "bg-orange-500",
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
