import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CARRIER_SHIPMENT_STATUSES,
  carrierShipmentStatus,
  useUpsertShipment,
  type CarrierShipmentStatus as Status,
  type RequestShipment,
} from "@/hooks/useRequestShipments";

export function CarrierShipmentStatus({ shipment, canEdit }: { shipment: RequestShipment; canEdit: boolean }) {
  const update = useUpsertShipment();
  const { toast } = useToast();
  const status = carrierShipmentStatus(shipment);

  async function save(next: Status) {
    const actualDate = next === "Доставлено" ? shipment.actual_arrival_date || format(new Date(), "yyyy-MM-dd") : null;
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
    } catch (error) {
      toast({ title: "Не удалось изменить статус перевозки", description: (error as Error).message, variant: "destructive" });
    }
  }

  if (!canEdit) return <Badge variant="outline">{status}</Badge>;
  return (
    <select
      aria-label={`Статус перевозки №${shipment.sequence_number}`}
      className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
      value={status}
      disabled={update.isPending}
      onChange={event => void save(event.target.value as Status)}
    >
      {CARRIER_SHIPMENT_STATUSES.map(option => <option key={option}>{option}</option>)}
    </select>
  );
}
