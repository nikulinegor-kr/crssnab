import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SHIPMENT_STATUSES,
  TRANSPORT_TYPES,
  type RequestShipment,
  type ShipmentStatus,
  type TransportType,
  useUpsertShipment,
} from "@/hooks/useRequestShipments";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  organizationId: string;
  shipment?: RequestShipment | null;
}

export function ShipmentDialog({ open, onOpenChange, requestId, organizationId, shipment }: Props) {
  const upsert = useUpsertShipment();
  const { toast } = useToast();
  const [transportType, setTransportType] = useState<TransportType>("auto");
  const [transportCompany, setTransportCompany] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [loadDate, setLoadDate] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("Ожидает погрузки");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setTransportType((shipment?.transport_type ?? "auto") as TransportType);
    setTransportCompany(shipment?.transport_company ?? "");
    setVehicleNumber(shipment?.vehicle_number ?? "");
    setTrailerNumber(shipment?.trailer_number ?? "");
    setDriverName(shipment?.driver_name ?? "");
    setDriverPhone(shipment?.driver_phone ?? "");
    setWaybillNumber(shipment?.waybill_number ?? "");
    setLoadDate(shipment?.load_date ?? "");
    setPlannedDate(shipment?.planned_arrival_date ?? "");
    setActualDate(shipment?.actual_arrival_date ?? "");
    setStatus((shipment?.status ?? "Ожидает погрузки") as ShipmentStatus);
    setComment(shipment?.comment ?? "");
  }, [open, shipment]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        id: shipment?.id,
        request_id: requestId,
        organization_id: organizationId,
        transport_type: transportType,
        transport_company: transportCompany || null,
        vehicle_number: vehicleNumber || null,
        trailer_number: trailerNumber || null,
        driver_name: driverName || null,
        driver_phone: driverPhone || null,
        waybill_number: waybillNumber || null,
        load_date: loadDate || null,
        planned_arrival_date: plannedDate || null,
        actual_arrival_date: actualDate || null,
        status,
        comment: comment || null,
      } as any);
      toast({ title: shipment ? "Перевозка обновлена" : "Перевозка добавлена" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {shipment ? `Перевозка №${shipment.sequence_number}` : "Новая перевозка"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1">
            <Label>Тип перевозки</Label>
            <Select value={transportType} onValueChange={(v) => setTransportType(v as TransportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIPMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label>Транспортная компания</Label>
            <Input value={transportCompany} onChange={(e) => setTransportCompany(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Госномер автомобиля</Label>
            <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="А123БВ77" />
          </div>
          <div className="space-y-1">
            <Label>Прицеп</Label>
            <Input value={trailerNumber} onChange={(e) => setTrailerNumber(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>ФИО водителя</Label>
            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Телефон водителя</Label>
            <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label>№ ТТН</Label>
            <Input value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Дата погрузки</Label>
            <Input type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Плановая дата прибытия</Label>
            <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Фактическая дата прибытия</Label>
            <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label>Комментарий</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {shipment ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
