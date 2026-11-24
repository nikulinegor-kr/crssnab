import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, Truck, Package, Train, Plane, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import type { Request } from "@/hooks/useRequests";
import { RequestReceiptButton } from "@/components/warehouse-qr/RequestReceiptButton";
import { Badge } from "@/components/ui/badge";
import {
  useRequestShipments,
  useShipmentItems,
  formatShipmentRoute,
  hasShipmentArrived,
  useUpsertShipment,
  type RequestShipment,
  type TransportType,
} from "@/hooks/useRequestShipments";

function TypeIcon({ type, className }: { type: TransportType; className?: string }) {
  const cls = className ?? "h-3.5 w-3.5";
  switch (type) {
    case "container": return <Package className={cls} />;
    case "rail": return <Train className={cls} />;
    case "air": return <Plane className={cls} />;
    case "sea": return <Ship className={cls} />;
    default: return <Truck className={cls} />;
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Завершена":
    case "Разгружена":
    case "Прибыла":
      return "bg-success/15 text-success border-success/30";
    case "В пути":
      return "bg-info/15 text-info border-info/30";
    case "Загружена":
      return "bg-info/15 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const fmt = (d: string | null) => (d ? format(new Date(d), "dd.MM.yyyy", { locale: ru }) : "—");

function ShipmentRow({ shipment, canEdit }: { shipment: RequestShipment; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useShipmentItems(open ? shipment.id : null);
  const [arrivalDate, setArrivalDate] = useState("");
  const updateShipment = useUpsertShipment();
  const { toast } = useToast();
  async function confirmArrival() {
    if (!arrivalDate || updateShipment.isPending) return;
    try {
      await updateShipment.mutateAsync({
        id: shipment.id,
        request_id: shipment.request_id,
        organization_id: shipment.organization_id,
        actual_arrival_date: arrivalDate,
        status: "Прибыла",
      });
      setArrivalDate("");
      toast({ title: "Прибытие отмечено" });
    } catch (error) {
      toast({ title: "Не удалось отметить прибытие", description: (error as { message?: string }).message, variant: "destructive" });
    }
  }


  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 px-2 hover:bg-muted/40 text-left rounded-md"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <TypeIcon type={shipment.transport_type} className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-semibold">Перевозка №{shipment.sequence_number}</span>
        {formatShipmentRoute(shipment) && <span className="text-xs">{formatShipmentRoute(shipment)}</span>}
        {shipment.vehicle_number && (
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            {shipment.vehicle_number}
          </Badge>
        )}
        {shipment.transport_company && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
            {shipment.transport_company}
          </span>
        )}
        {shipment.waybill_number && <span className="text-xs text-muted-foreground">ТТН {shipment.waybill_number}</span>}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(shipment.status)}`}>
          {shipment.status}
        </Badge>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {shipment.load_date && (
            <span>Отправка: <span className="text-foreground">{fmt(shipment.load_date)}</span></span>
          )}
          {shipment.planned_arrival_date && <span>План доставки: {fmt(shipment.planned_arrival_date)}</span>}
          {shipment.actual_arrival_date && (
            <span>
              Факт доставки:{" "}
              <span className={shipment.actual_arrival_date ? "text-success" : "text-foreground"}>
                {fmt(shipment.actual_arrival_date)}
              </span>
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="pl-8 pr-3 py-1.5 bg-muted/20 border-t border-border/30 rounded-b-md">
          {canEdit && !hasShipmentArrived(shipment) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {arrivalDate ? <>
                <Input type="date" aria-label="Фактическая дата доставки" min={shipment.load_date ?? undefined}
                  max={format(new Date(), "yyyy-MM-dd")} value={arrivalDate}
                  onChange={event => setArrivalDate(event.target.value)} className="h-9 w-auto" />
                <Button type="button" size="sm" disabled={updateShipment.isPending || Boolean(shipment.load_date && arrivalDate < shipment.load_date) || arrivalDate > format(new Date(), "yyyy-MM-dd")}
                  onClick={() => void confirmArrival()}>Подтвердить прибытие</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setArrivalDate("")}>Отмена</Button>
              </> : (
                <Button type="button" variant="outline" size="sm" onClick={() => setArrivalDate(format(new Date(), "yyyy-MM-dd"))}>Отметить, что прибыло</Button>
              )}
            </div>
          )}
          {isLoading ? (
            <div className="text-[11px] text-muted-foreground">Загрузка материалов…</div>
          ) : items.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              Нет материалов в этой машине
            </div>
          ) : (
            <ul className="space-y-0.5">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground/60">└─</span>
                  <span className="flex-1 text-foreground">{it.material_name}</span>
                  <span className="text-muted-foreground font-numeric tabular-nums">
                    {it.quantity != null ? new Intl.NumberFormat("ru-RU").format(Number(it.quantity)) : "—"}
                    {it.unit ? ` ${it.unit}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function RequestShipmentsTree({ request }: { request: Request }) {
  const { canEdit } = useUserRole();
  const { data: shipments = [], isLoading } = useRequestShipments(request.id);

  if (isLoading) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">Загрузка перевозок…</div>;
  }
  if (shipments.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground italic">
        Перевозок нет
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-l-4 border-primary/40 py-2 px-3">
      <div className="max-w-3xl space-y-1.5">
        {shipments.map((s) => (
          <ShipmentRow key={s.id} shipment={s} canEdit={canEdit} />
        ))}
        {shipments.some(hasShipmentArrived) && <RequestReceiptButton request={request} />}
      </div>
    </div>
  );
}


/** Progress chip: X/Y машин прибыло */
export function ShipmentsProgressChip({
  total,
  delivered,
}: {
  total: number;
  delivered: number;
}) {
  if (total < 1) return null;
  const done = delivered >= total;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
        done
          ? "bg-success/15 text-success"
          : "bg-warning/15 text-warning"
      }`}
      title="Доставленные перевозки из общего числа"
    >
      <Truck className="h-3 w-3" />
      {delivered > 0 && !done ? "Частично доставлено" : "Доставлено"} {delivered} из {total}
    </span>
  );
}
