import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CARRIER_SHIPMENT_STATUSES,
  carrierShipmentStatus,
  useUpsertShipment,
  type CarrierShipmentStatus as Status,
  type RequestShipment,
} from "@/hooks/useRequestShipments";

export function CarrierShipmentStatus({ shipment, canEdit, dateDialogOpen = false, onDateDialogOpenChange }: {
  shipment: RequestShipment;
  canEdit: boolean;
  dateDialogOpen?: boolean;
  onDateDialogOpenChange?: (open: boolean) => void;
}) {
  const update = useUpsertShipment();
  const { toast } = useToast();
  const status = carrierShipmentStatus(shipment);
  const [arrivalDate, setArrivalDate] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");
  useEffect(() => {
    if (dateDialogOpen) setArrivalDate(shipment.actual_arrival_date || today);
  }, [dateDialogOpen, shipment.actual_arrival_date, today]);

  async function save(next: Status, actualDate: string | null = null) {
    if (actualDate && shipment.load_date && actualDate < shipment.load_date) {
      toast({ title: "Дата доставки раньше даты отгрузки", variant: "destructive" });
      return;
    }
    try {
      await update.mutateAsync({
        id: shipment.id,
        request_id: shipment.request_id,
        organization_id: shipment.organization_id,
        status: next,
        actual_arrival_date: actualDate,
      });
      onDateDialogOpenChange?.(false);
    } catch (error) {
      toast({ title: "Не удалось изменить статус перевозки", description: (error as Error).message, variant: "destructive" });
    }
  }

  const tone = status === "Доставлено" ? "border-success/25 bg-success/10 text-success"
    : status === "Доставлено в ТК" ? "border-warning/25 bg-warning/10 text-warning"
    : "border-primary/25 bg-primary/10 text-primary";

  if (!canEdit) return <Badge variant="outline" className={tone}>{status}</Badge>;
  return (
    <>
      <select
        aria-label={`Статус перевозки №${shipment.sequence_number}`}
        className={cn("h-8 max-w-full rounded-full border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone)}
        value={status}
        disabled={update.isPending}
        onChange={event => {
          const next = event.target.value;
          if (next === "Доставлено" || next === "edit-arrival-date") {
            onDateDialogOpenChange?.(true);
          } else {
            void save(next as Status);
          }
        }}
      >
        {CARRIER_SHIPMENT_STATUSES.map(option => <option key={option}>{option}</option>)}
        {status === "Доставлено" && <option value="edit-arrival-date">Изменить дату доставки</option>}
      </select>
      <Dialog open={dateDialogOpen} onOpenChange={open => { if (!update.isPending) onDateDialogOpenChange?.(open); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Доставка перевозки №{shipment.sequence_number}</DialogTitle></DialogHeader>
          <Label htmlFor={`carrier-arrival-${shipment.id}`}>Фактическая дата доставки</Label>
          <Input id={`carrier-arrival-${shipment.id}`} type="date" min={shipment.load_date ?? undefined} max={today}
            value={arrivalDate} onChange={event => setArrivalDate(event.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={update.isPending} onClick={() => onDateDialogOpenChange?.(false)}>Отмена</Button>
            <Button type="button" disabled={update.isPending || !arrivalDate || arrivalDate > today || Boolean(shipment.load_date && arrivalDate < shipment.load_date)}
              onClick={() => void save("Доставлено", arrivalDate)}>{update.isPending ? "Сохраняем…" : "Сохранить дату"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
