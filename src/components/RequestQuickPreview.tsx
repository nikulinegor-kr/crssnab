import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Calendar, User, Truck, FileText, RussianRuble, AlertCircle, Pencil, Package, Send, Clock } from "lucide-react";
import { Request } from "@/hooks/useRequests";

interface RequestQuickPreviewProps {
  request: Request;
  children: React.ReactNode;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  onEdit?: (request: Request) => void;
}

export const RequestQuickPreview = ({
  request,
  children,
  getStatusColor,
  getPriorityColor,
  onEdit,
}: RequestQuickPreviewProps) => {
  const isOverdue = request.delivery_date &&
    new Date(request.delivery_date) < new Date() &&
    request.status !== "Доставлено" &&
    request.status !== "Выполнено";

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-0 shadow-xl border border-border/50 bg-card/95 backdrop-blur-sm" 
        side="top" 
        align="start"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header Section */}
        <div className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {request.request_number}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(request.request_date), "d MMM yyyy", { locale: ru })}
                </span>
              </div>
              <p className="font-semibold text-sm leading-tight line-clamp-2">
                {request.description}
              </p>
            </div>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 pointer-events-auto"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(request);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          
          {/* Status & Priority Badges */}
          <div className="flex items-center gap-1.5 mt-2">
            <Badge
              className="text-[10px] px-2 py-0.5"
              style={{
                backgroundColor: getStatusColor(request.status),
                color: "#fff",
              }}
            >
              {request.status}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5"
              style={{
                borderColor: getPriorityColor(request.priority || ""),
                color: getPriorityColor(request.priority || ""),
              }}
            >
              {request.priority}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 gap-1">
                <AlertCircle className="h-3 w-3" />
                Просрочено
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Key Info Badges */}
        {(request.availability_delivery_time || request.shipment_date || request.delivery_date || request.transport_company || request.waybill_number) && (
          <>
            <div className="p-3 py-2 flex flex-wrap gap-1.5">
              {request.availability_delivery_time && (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  <Package className="h-3 w-3" />
                  {request.availability_delivery_time}
                </Badge>
              )}
              {request.shipment_date && (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
                  <Send className="h-3 w-3" />
                  {format(new Date(request.shipment_date), "d MMM", { locale: ru })}
                </Badge>
              )}
              {request.delivery_date && (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(request.delivery_date), "d MMM", { locale: ru })}
                </Badge>
              )}
              {request.transport_company && (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
                  <Truck className="h-3 w-3" />
                  {request.transport_company}
                </Badge>
              )}
              {request.waybill_number && (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-0">
                  <FileText className="h-3 w-3" />
                  ТТН: {request.waybill_number}
                </Badge>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Details Section */}
        <div className="p-3 py-2 space-y-2">
          {/* People */}
          {(request.applicant || request.executor || request.contractor) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {request.applicant && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3 w-3 shrink-0 text-primary/60" />
                  <span className="truncate max-w-[100px]">{request.applicant}</span>
                </div>
              )}
              {request.executor && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3 w-3 shrink-0 text-green-500/60" />
                  <span className="truncate max-w-[100px]">{request.executor}</span>
                </div>
              )}
              {request.contractor && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Truck className="h-3 w-3 shrink-0 text-orange-500/60" />
                  <span className="truncate max-w-[120px]">{request.contractor}</span>
                </div>
              )}
            </div>
          )}

          {/* Financial */}
          {(request.amount || request.invoice_number || request.payment_percentage !== null) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {request.amount && request.amount > 0 && (
                <div className="flex items-center gap-1.5 font-medium">
                  <RussianRuble className="h-3 w-3 shrink-0 text-primary" />
                  <span>
                    {new Intl.NumberFormat("ru-RU", {
                      style: "currency",
                      currency: "RUB",
                      maximumFractionDigits: 0,
                    }).format(Number(request.amount))}
                  </span>
                </div>
              )}
              {request.invoice_number && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span>№{request.invoice_number}</span>
                </div>
              )}
              {request.payment_percentage !== null && request.payment_percentage !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0 text-green-500" />
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {request.payment_percentage}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comments Footer */}
        {request.comments && (
          <>
            <Separator />
            <div className="p-3 py-2 bg-muted/30">
              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                "{request.comments}"
              </p>
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
