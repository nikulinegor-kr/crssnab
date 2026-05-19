import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Calendar,
  MoreHorizontal,
  Package,
  User as UserIcon,
  ExternalLink,
  Copy as CopyIcon,
  MessageCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Request } from "@/hooks/useRequests";

interface Props {
  request: Request & {
    object_name?: string | null;
    items_count?: number;
  };
  overlay?: boolean;
  onOpen?: (id: string) => void;
}

function priorityColor(p: string | null | undefined) {
  switch (p) {
    case "Аварийно":
      return "bg-red-500";
    case "Срочно":
      return "bg-orange-500";
    case "Планово":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground/40";
  }
}

export function BoardCard({ request, overlay, onOpen }: Props) {
  const { toast } = useToast();
  const sortable = useSortable({ id: request.id, data: { request } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  };

  const isOverdue =
    !!request.delivery_date &&
    new Date(request.delivery_date) < new Date() &&
    !["Доставлено", "Выполнено"].includes(request.status);

  const isUrgent = request.priority === "Аварийно" || request.priority === "Срочно";
  const noSupplier = !request.contractor;
  const paid = request.payment_status === "Оплачено" || (request.payment_percent ?? 0) >= 100;

  const title = request.description?.trim() || `Заявка #${request.request_number}`;

  const copyTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(title);
    toast({ title: "Скопировано" });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (overlay) return;
    // Не открываем drawer, если клик пришёл из меню/кнопки
    if ((e.target as HTMLElement).closest("[data-no-card-open]")) return;
    onOpen?.(request.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "group relative rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing",
        overlay && "shadow-xl ring-2 ring-primary/40 rotate-1"
      )}
    >
      {/* priority stripe */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
          priorityColor(request.priority)
        )}
      />

      <div className="p-3 pl-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug line-clamp-2">
            {title}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-no-card-open
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground p-0.5 -mr-1 rounded"
                aria-label="Действия"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" data-no-card-open>
              <DropdownMenuItem asChild>
                <Link to={`/requests/${request.id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Открыть заявку
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyTitle}>
                <CopyIcon className="h-4 w-4 mr-2" /> Копировать название
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(
                    window.location.origin + "/requests/" + request.id
                  )}&text=${encodeURIComponent(title)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Поделиться в Telegram
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(title)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {request.contractor && (
          <div className="text-xs text-muted-foreground truncate">{request.contractor}</div>
        )}

        <div className="flex flex-wrap gap-1">
          {isUrgent && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
              {request.priority}
            </Badge>
          )}
          {isOverdue && (
            <Badge
              variant="outline"
              className="h-5 text-[10px] px-1.5 border-red-500/40 text-red-600"
            >
              <AlertTriangle className="h-3 w-3 mr-0.5" /> Просрочено
            </Badge>
          )}
          {noSupplier && (
            <Badge variant="outline" className="h-5 text-[10px] px-1.5">
              Нет поставщика
            </Badge>
          )}
          {paid && (
            <Badge className="h-5 text-[10px] px-1.5 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
              Оплачено
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            {request.executor ? (
              <span className="flex items-center gap-1 truncate">
                <UserIcon className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{request.executor}</span>
              </span>
            ) : (
              <span className="opacity-60">— исп.</span>
            )}
            {request.items_count != null && request.items_count > 0 && (
              <span className="flex items-center gap-0.5">
                <Package className="h-3 w-3" />
                {request.items_count}
              </span>
            )}
          </div>
          {request.delivery_date && (
            <span
              className={cn(
                "flex items-center gap-0.5 font-numeric",
                isOverdue && "text-red-600"
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(request.delivery_date), "d MMM", { locale: ru })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
