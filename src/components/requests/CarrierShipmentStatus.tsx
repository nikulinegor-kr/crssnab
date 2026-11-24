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

  const tone = status === "Доставлено" ? "border-success/25 bg-success/10 text-success"
    : status === "Доставлено в ТК" ? "border-warning/25 bg-warning/10 text-warning"
    : "border-primary/25 bg-primary/10 text-primary";

  if (!canEdit) return <Badge variant="outline" className={tone}>{status}</Badge>;
  return (
    <select
      aria-label={`Статус перевозки №${shipment.sequence_number}`}
      className={cn("h-8 max-w-full rounded-full border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone)}
      value={status}
      disabled={update.isPending}
      onChange={event => void save(event.target.value as Status)}
    >
      {CARRIER_SHIPMENT_STATUSES.map(option => <option key={option}>{option}</option>)}
    </select>
  );
}
