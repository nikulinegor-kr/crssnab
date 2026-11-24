import { useState, type ReactNode } from "react";
import { Pencil, Truck } from "lucide-react";
import { carrierShipmentStatus, type RequestShipment } from "@/hooks/useRequestShipments";
import { CarrierShipmentStatus } from "./CarrierShipmentStatus";

function displayDate(value: string | null) {
  return value ? value.split("-").reverse().join(".") : "—";
}

export function CarrierShipmentRow({ shipment, canEdit, actions }: {
  shipment: RequestShipment;
  canEdit: boolean;
  actions?: ReactNode;
}) {
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const delivered = carrierShipmentStatus(shipment) === "Доставлено";

  return (
    <div className="request-shipments-tree__row">
      <div className="request-shipments-tree__identity">
        <span className="request-shipments-tree__node"><Truck size={15} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="font-semibold [overflow-wrap:anywhere]">{shipment.transport_company || "Перевозка"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
            №{shipment.sequence_number}{shipment.waybill_number && ` · ТТН ${shipment.waybill_number}`}
          </p>
        </div>
      </div>
      <dl className="request-shipments-tree__dates">
        <div><dt>Отгрузка</dt><dd>{displayDate(shipment.load_date)}</dd></div>
        <div><dt>План доставки</dt><dd>{displayDate(shipment.planned_arrival_date)}</dd></div>
        <div>
          <dt>Факт доставки</dt>
          <dd className={shipment.actual_arrival_date ? "text-success" : undefined}>
            {canEdit && delivered ? (
              <button type="button" className="inline-flex items-center gap-1 rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Изменить фактическую дату перевозки №${shipment.sequence_number}`}
                onClick={() => setDateDialogOpen(true)}>
                {shipment.actual_arrival_date ? displayDate(shipment.actual_arrival_date) : "Указать"} <Pencil aria-hidden="true" className="size-3 shrink-0" />
              </button>
            ) : displayDate(shipment.actual_arrival_date)}
          </dd>
        </div>
      </dl>
      <div className="request-shipments-tree__status"><CarrierShipmentStatus shipment={shipment} canEdit={canEdit} dateDialogOpen={dateDialogOpen} onDateDialogOpenChange={setDateDialogOpen} />{actions}</div>
    </div>
  );
}
