import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, Truck, Package, Train, Plane, Ship } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useRequestShipments,
  useShipmentItems,
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
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "В пути":
      return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    case "Загружена":
      return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const fmt = (d: string | null) => (d ? format(new Date(d), "dd.MM.yyyy", { locale: ru }) : "—");

function ShipmentRow({ shipment }: { shipment: RequestShipment }) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useShipmentItems(open ? shipment.id : null);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted/40 text-left"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <TypeIcon type={shipment.transport_type} className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Машина №{shipment.sequence_number}</span>
        {shipment.vehicle_number && (
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            {shipment.vehicle_number}
          </Badge>
        )}
        {shipment.transport_company && (
          <span className="text-[11px] text-muted-foreground truncate">
            {shipment.transport_company}
          </span>
        )}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(shipment.status)}`}>
          {shipment.status}
        </Badge>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          {shipment.load_date && (
            <span>Отправка: <span className="text-foreground">{fmt(shipment.load_date)}</span></span>
          )}
          {(shipment.actual_arrival_date || shipment.planned_arrival_date) && (
            <span>
              Приход:{" "}
              <span className={shipment.actual_arrival_date ? "text-emerald-700" : "text-foreground"}>
                {fmt(shipment.actual_arrival_date ?? shipment.planned_arrival_date)}
              </span>
              {!shipment.actual_arrival_date && shipment.planned_arrival_date && (
                <span className="text-muted-foreground/70"> (план)</span>
              )}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="pl-10 pr-3 py-1.5 bg-muted/20 border-t border-border/30">
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

export function RequestShipmentsTree({ requestId }: { requestId: string }) {
  const { data: shipments = [], isLoading } = useRequestShipments(requestId);

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
    <div className="bg-muted/20 border-l-4 border-primary/40">
      {shipments.map((s) => (
        <ShipmentRow key={s.id} shipment={s} />
      ))}
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
          ? "bg-emerald-500/15 text-emerald-700"
          : "bg-amber-500/15 text-amber-700"
      }`}
      title="Прибывшие машины из общего числа"
    >
      <Truck className="h-3 w-3" />
      {delivered}/{total} {done ? "прибыло" : "прибыло"}
    </span>
  );
}
