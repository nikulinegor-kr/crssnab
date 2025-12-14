import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Calendar, User, Truck, FileText, DollarSign, AlertCircle } from "lucide-react";
import { Request } from "@/hooks/useRequests";

interface RequestQuickPreviewProps {
  request: Request;
  children: React.ReactNode;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
}

export const RequestQuickPreview = ({
  request,
  children,
  getStatusColor,
  getPriorityColor,
}: RequestQuickPreviewProps) => {
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" side="top" align="start">
        <Card className="border-0 shadow-none">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {request.request_number}
                </span>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: `${getPriorityColor(request.priority || "")}20`,
                    color: getPriorityColor(request.priority || ""),
                  }}
                  className="text-xs"
                >
                  {request.priority}
                </Badge>
              </div>
              <p className="font-medium text-sm line-clamp-2">
                {request.description}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge
                style={{
                  backgroundColor: getStatusColor(request.status),
                  color: "#fff",
                }}
              >
                {request.status}
              </Badge>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {request.applicant && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{request.applicant}</span>
                </div>
              )}

              {request.executor && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{request.executor}</span>
                </div>
              )}

              {request.contractor && (
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{request.contractor}</span>
                </div>
              )}

              {request.delivery_date && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {format(new Date(request.delivery_date), "d MMM yyyy", {
                      locale: ru,
                    })}
                  </span>
                </div>
              )}

              {request.amount && request.amount > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
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
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>Счёт: {request.invoice_number}</span>
                </div>
              )}
            </div>

            {/* Comments */}
            {request.comments && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {request.comments}
                </p>
              </div>
            )}

            {/* Deadline warning */}
            {request.delivery_date &&
              new Date(request.delivery_date) < new Date() &&
              request.status !== "Доставлено" && (
                <div className="flex items-center gap-1.5 text-destructive text-xs pt-2 border-t">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Просрочена</span>
                </div>
              )}
          </CardContent>
        </Card>
      </HoverCardContent>
    </HoverCard>
  );
};
