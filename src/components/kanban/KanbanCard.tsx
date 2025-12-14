import React, { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  request: {
    id: string;
    request_number: string;
    description: string;
    status: string;
    priority: string;
    applicant: string | null;
    contractor: string | null;
    request_date: string;
    delivery_date: string | null;
    executor: string | null;
  };
  isSelectionMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
  deadlineStatus: { isOverdue: boolean; daysOverdue: number; label: string } | null;
  settings: {
    showRequestNumber: boolean;
    showPriority: boolean;
    showDeadline: boolean;
    showExecutor: boolean;
    showApplicant: boolean;
    showContractor: boolean;
  };
  onDragStart: (e: React.DragEvent, requestId: string) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent) => void;
  getPriorityColor: (priority: string) => string;
  style?: React.CSSProperties;
}

export const KanbanCard = memo(function KanbanCard({
  request,
  isSelectionMode,
  isSelected,
  isDragging,
  deadlineStatus,
  settings,
  onDragStart,
  onDragEnd,
  onClick,
  getPriorityColor,
  style,
}: KanbanCardProps) {
  return (
    <div style={style}>
      <div
        draggable={!isSelectionMode}
        onDragStart={(e) => !isSelectionMode && onDragStart(e, request.id)}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={cn(
          "p-3 rounded-lg bg-background border cursor-pointer mx-2.5",
          "hover:shadow-md transition-all",
          "active:scale-[0.98]",
          isDragging && "opacity-50 scale-95",
          deadlineStatus?.isOverdue && "border-destructive/50 bg-destructive/5",
          !deadlineStatus?.isOverdue && "border-border/40 hover:border-primary/40",
          isSelected && "ring-2 ring-primary border-primary"
        )}
      >
        <div className="flex items-start gap-2">
          {isSelectionMode ? (
            <Checkbox 
              checked={isSelected} 
              className="mt-0.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab" />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium line-clamp-2 leading-snug">
              {request.description}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {settings.showRequestNumber && (
                <span className="text-xs text-muted-foreground font-mono">
                  #{request.request_number.slice(-6)}
                </span>
              )}
              {settings.showPriority && (
                <Badge
                  variant="outline"
                  className={cn("text-xs px-2 py-0.5 h-5", getPriorityColor(request.priority))}
                >
                  {request.priority}
                </Badge>
              )}
            </div>
            
            {/* Deadline indicator */}
            {settings.showDeadline && deadlineStatus && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                deadlineStatus.isOverdue ? "text-destructive" : "text-warning"
              )}>
                <AlertTriangle className="h-3 w-3" />
                <span>{deadlineStatus.label}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(request.request_date), "dd.MM.yy", { locale: ru })}</span>
              {settings.showExecutor && request.executor && (
                <span className="truncate max-w-[100px] text-primary/70" title={request.executor}>
                  {request.executor}
                </span>
              )}
            </div>
            
            {/* Additional fields based on settings */}
            {(settings.showApplicant && request.applicant) || (settings.showContractor && request.contractor) ? (
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {settings.showApplicant && request.applicant && (
                  <span className="truncate" title={request.applicant}>
                    Заявитель: {request.applicant}
                  </span>
                )}
                {settings.showContractor && request.contractor && (
                  <span className="truncate" title={request.contractor}>
                    Подрядчик: {request.contractor}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
