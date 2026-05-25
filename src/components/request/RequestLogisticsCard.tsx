import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CommitOnBlurInputProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function CommitOnBlurInput({ value, onCommit, placeholder, className }: CommitOnBlurInputProps) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  const commit = () => {
    if ((local ?? "") !== (value ?? "")) onCommit(local);
  };
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setLocal(value ?? ""); (e.target as HTMLInputElement).blur(); }
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Truck, 
  Package, 
  CalendarDays, 
  MapPin,
  FileText,
  CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Request } from "@/hooks/useRequests";

function getDeliveryDateTone(dateStr?: string | null, status?: string | null) {
  if (!dateStr) return null;
  const finalStatuses = ["Доставлено", "Прибыло", "Закрыто", "Отменено", "Выполнено"];
  if (status && finalStatuses.includes(status)) {
    return { label: "Прибыло", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Просрочка ${Math.abs(days)} дн.`, className: "bg-red-500/10 text-red-600 border-red-500/30" };
  if (days === 0) return { label: "Сегодня", className: "bg-red-500/10 text-red-600 border-red-500/30" };
  if (days === 1) return { label: "Завтра", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" };
  if (days <= 3) return { label: `Через ${days} дн.`, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  return { label: `Через ${days} дн.`, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
}

interface RequestLogisticsCardProps {
  request: Request;
  canEdit: boolean;
  onUpdate: (updates: Partial<Request>) => void;
}

export function RequestLogisticsCard({ 
  request, 
  canEdit, 
  onUpdate 
}: RequestLogisticsCardProps) {
  const logisticsItems = [
    {
      icon: Package,
      label: "Наличие / срок",
      value: request.availability_delivery_time,
      editable: false,
    },
    {
      icon: Truck,
      label: "Транспортная компания",
      value: request.transport_company,
      field: "transport_company",
      placeholder: "Введите ТК",
    },
    {
      icon: FileText,
      label: "Номер ТТН",
      value: request.waybill_number,
      field: "waybill_number",
      placeholder: "Номер накладной",
    },
  ];

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Логистика
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Grid of logistics items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {logisticsItems.map((item) => (
            <div 
              key={item.label}
              className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 rounded-md bg-primary/10 shrink-0">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                {canEdit && item.field ? (
                  <Input
                    value={(item.value as string) || ""}
                    onChange={(e) => onUpdate({ [item.field!]: e.target.value || null })}
                    placeholder={item.placeholder}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium truncate">
                    {item.value || "—"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border/40">
          {/* Shipment date */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
            <div className="p-2 rounded-md bg-amber-500/10 shrink-0">
              <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Дата отправки</p>
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-sm",
                        !request.shipment_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {request.shipment_date
                        ? format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })
                        : "Выберите дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={request.shipment_date ? new Date(request.shipment_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          onUpdate({ shipment_date: format(date, "yyyy-MM-dd") });
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-sm font-medium">
                  {request.shipment_date 
                    ? format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })
                    : "—"
                  }
                </p>
              )}
            </div>
          </div>

          {/* Delivery date */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
            <div className="p-2 rounded-md bg-green-500/10 shrink-0">
              <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-muted-foreground">Дата доставки</p>
                {(() => {
                  const tone = getDeliveryDateTone(request.delivery_date, request.status);
                  return tone ? (
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", tone.className)}>
                      {tone.label}
                    </span>
                  ) : null;
                })()}
              </div>
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-sm",
                        !request.delivery_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {request.delivery_date
                        ? format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })
                        : "Выберите дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={request.delivery_date ? new Date(request.delivery_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          onUpdate({ delivery_date: format(date, "yyyy-MM-dd") });
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-sm font-medium">
                  {request.delivery_date 
                    ? format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })
                    : "—"
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
