import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FileText } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { RequestWithoutTask } from "@/hooks/useRequestsWithoutTasks";

export function UnassignedRequestCard({
  request,
  onClick,
}: {
  request: RequestWithoutTask;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `req:${request.id}`,
    data: { type: "request", request },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      onClick={onClick}
      className="group relative rounded-lg border border-dashed border-border/70 bg-card/60 hover:border-primary/40 transition-all cursor-pointer p-3 space-y-1.5"
    >
      <div className="flex items-start gap-2">
        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-sm leading-snug line-clamp-3">
          {request.description || request.request_number || "Без описания"}
        </div>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
          aria-label="Перетащить"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className={cn("rounded px-1.5 py-0.5 bg-primary/10 text-primary font-medium")}>из заявки</span>
        {request.status && <span className="truncate">{request.status}</span>}
        {request.delivery_date && (
          <span className="font-numeric ml-auto">
            {format(new Date(request.delivery_date), "d MMM", { locale: ru })}
          </span>
        )}
      </div>
    </div>
  );
}
