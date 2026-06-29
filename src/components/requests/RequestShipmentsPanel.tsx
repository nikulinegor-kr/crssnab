import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Pencil, Trash2, Truck, Package, Train, Plane, Ship, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteShipment,
  useDeleteShipmentItem,
  useRequestShipments,
  useShipmentItems,
  useUpsertShipmentItem,
  type RequestShipment,
  type TransportType,
} from "@/hooks/useRequestShipments";
import { ShipmentDialog } from "./ShipmentDialog";

function TypeIcon({ type, className }: { type: TransportType; className?: string }) {
  const cls = className ?? "h-4 w-4";
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
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "В пути":
      return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    case "Прибыла":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "Загружена":
      return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function fmt(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy", { locale: ru }) : "—";
}

function ShipmentItemsBlock({ shipment, organizationId, canEdit }: { shipment: RequestShipment; organizationId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useShipmentItems(shipment.id);
  const upsert = useUpsertShipmentItem();
  const del = useDeleteShipmentItem();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("шт.");

  const add = async () => {
    if (!name.trim()) return;
    await upsert.mutateAsync({
      shipment_id: shipment.id,
      organization_id: organizationId,
      material_name: name.trim(),
      quantity: qty ? Number(qty) : null,
      unit: unit || null,
    });
    setName(""); setQty("");
  };

  return (
    <div className="pl-6 mt-2 border-l-2 border-muted">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Материалы</div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">Нет материалов</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1">{it.material_name}</span>
              <span className="text-muted-foreground font-numeric">
                {it.quantity ?? "—"} {it.unit ?? ""}
              </span>
              {canEdit && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => del.mutate({ id: it.id, shipment_id: shipment.id })}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-1 mt-2">
          <Input
            placeholder="Материал"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <Input
            placeholder="Кол-во"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-7 text-xs w-20"
            inputMode="decimal"
          />
          <Input
            placeholder="Ед."
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-7 text-xs w-16"
          />
          <Button type="button" size="sm" variant="secondary" className="h-7" onClick={add}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface PanelProps {
  requestId: string;
  organizationId: string;
  canEdit?: boolean;
}

export function RequestShipmentsPanel({ requestId, organizationId, canEdit = true }: PanelProps) {
  const { data: shipments = [], isLoading } = useRequestShipments(requestId);
  const del = useDeleteShipment();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RequestShipment | null>(null);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: RequestShipment) => { setEditing(s); setDialogOpen(true); };

  return (
    <div className="bg-muted/30 border-l-4 border-primary/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Перевозки по заявке</div>
        {canEdit && (
          <Button type="button" size="sm" variant="default" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Добавить перевозку
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Загрузка…</div>
      ) : shipments.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-4 text-center">
          Перевозок ещё нет. Нажмите «Добавить перевозку», чтобы создать первую.
        </div>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => (
            <div key={s.id} className="bg-background rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeIcon type={s.transport_type} className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">№{s.sequence_number}</span>
                  {s.transport_company && <span className="text-sm text-muted-foreground">{s.transport_company}</span>}
                  {s.vehicle_number && (
                    <Badge variant="outline" className="font-mono text-[11px]">{s.vehicle_number}</Badge>
                  )}
                  <Badge variant="outline" className={`text-[11px] ${statusBadgeClass(s.status)}`}>{s.status}</Badge>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Удалить перевозку №${s.sequence_number}?`)) {
                          del.mutate({ id: s.id, request_id: requestId });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs mt-2">
                {s.driver_name && <div><span className="text-muted-foreground">Водитель:</span> {s.driver_name}</div>}
                {s.driver_phone && <div><span className="text-muted-foreground">Тел:</span> {s.driver_phone}</div>}
                {s.waybill_number && <div><span className="text-muted-foreground">ТТН:</span> {s.waybill_number}</div>}
                {s.trailer_number && <div><span className="text-muted-foreground">Прицеп:</span> {s.trailer_number}</div>}
                <div><span className="text-muted-foreground">Погрузка:</span> {fmt(s.load_date)}</div>
                <div><span className="text-muted-foreground">План:</span> {fmt(s.planned_arrival_date)}</div>
                <div><span className="text-muted-foreground">Факт:</span> {fmt(s.actual_arrival_date)}</div>
              </div>

              {s.comment && (
                <div className="text-xs text-muted-foreground mt-1 italic">{s.comment}</div>
              )}

              <ShipmentItemsBlock shipment={s} organizationId={organizationId} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}

      <ShipmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestId={requestId}
        organizationId={organizationId}
        shipment={editing}
      />
    </div>
  );
}

export function ShipmentsSummaryChips({
  total,
  delivered,
  inTransit,
  overdue,
}: {
  total: number;
  delivered: number;
  inTransit: number;
  overdue: number;
}) {
  if (total < 2) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
      <span title="Всего перевозок">🚛 {total}</span>
      {delivered > 0 && <span className="text-emerald-600" title="Доставлено">🟢 {delivered}</span>}
      {inTransit > 0 && <span className="text-amber-600" title="В пути">🟡 {inTransit}</span>}
      {overdue > 0 && <span className="text-red-600 font-medium" title="Просрочено">🔴 {overdue}</span>}
    </div>
  );
}
