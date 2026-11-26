import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logisticsStatuses, subscribeToRequestLogistics, type LogisticsIntent } from "@/lib/requestDeliveryReceipt";
import { useToast } from "@/hooks/use-toast";

export function RequestLogisticsPrompt() {
  const [intents, setIntents] = useState<LogisticsIntent[]>([]);
  const intent = intents[0];
  const close = () => setIntents(previous => previous.slice(1));
  useEffect(() => subscribeToRequestLogistics(intent => setIntents(previous => [...previous, intent])), []);
  const { data, error } = useQuery({
    queryKey: ["logistics-prompt", intent?.requestId],
    enabled: !!intent,
    queryFn: async () => {
      const { data, error } = await supabase.from("requests")
        .select("id,description,shipment_date,delivery_date,transport_company")
        .eq("id", intent!.requestId).single();
      if (error) throw error;
      return data;
    },
  });
  if (!intent) return null;
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    {data ? <LogisticsFields key={intent.requestId} request={data} intent={intent} onClose={close} /> :
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Следующий шаг по заявке</DialogTitle></DialogHeader>
        <p role={error ? "alert" : "status"}>{error ? error.message : "Загружаем заявку…"}</p>
      </DialogContent>}
  </Dialog>;
}

function LogisticsFields({ request, intent, onClose }: {
  request: { id: string; description: string; shipment_date: string | null; delivery_date: string | null; transport_company: string | null };
  intent: LogisticsIntent;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(intent.status);
  const [shipment, setShipment] = useState(intent.draft?.shipment ?? request.shipment_date ?? "");
  const [arrival, setArrival] = useState(intent.draft?.arrival ?? request.delivery_date ?? "");
  const [carrier, setCarrier] = useState(intent.draft?.carrier ?? request.transport_company ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const inTransit = status === "В пути";
  async function save() {
    if (!status || !shipment || (inTransit && (!arrival || !carrier.trim() || arrival < shipment))) return;
    setSaving(true);
    setError("");
    try {
      const fields = {
        status, shipment_date: shipment,
        ...(inTransit ? { delivery_date: arrival, transport_company: carrier.trim() } : {}),
      };
      if (intent.draft) {
        await intent.draft.apply(fields);
        onClose();
        return;
      }
      const { data, error } = await supabase.from("requests").update(fields)
        .eq("id", request.id).select("id,status,updated_at,shipment_date,delivery_date,transport_company").single();
      if (error) throw error;
      qc.setQueriesData({ queryKey: ["requests"] }, (previous: unknown) =>
        Array.isArray(previous) ? previous.map(row => row.id === data.id ? { ...row, ...data } : row) : previous);
      void qc.invalidateQueries({ queryKey: ["requests"] });
      void qc.invalidateQueries({ queryKey: ["request", request.id] });
      intent.onSaved?.(data);
      toast({ title: "Статус обновлён", description: status });
      onClose();
    } catch (error) {
      setError((error as { message?: string })?.message || "Не удалось сохранить статус");
    } finally { setSaving(false); }
  }
  return <DialogContent className="sm:max-w-md" onInteractOutside={event => { if (saving) event.preventDefault(); }}
    onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} hideCloseButton={saving}>
    <DialogHeader>
      <DialogTitle>{status || "Что сделать дальше с заявкой?"}</DialogTitle>
      <DialogDescription>{intent.percent ? `Оплата ${intent.percent}% сохранена. ` : ""}{request.description}</DialogDescription>
    </DialogHeader>
    {!status ? <div className="grid gap-2">{logisticsStatuses.map(option =>
      <Button key={option} variant="outline" onClick={() => setStatus(option)}>{option}</Button>
    )}<Button variant="ghost" onClick={onClose}>Оставить текущий статус</Button></div> : <>
      <div className="grid gap-2">
        <Label htmlFor="request-transition-shipment">Дата отгрузки *</Label>
        <Input id="request-transition-shipment" type="date" value={shipment} onChange={event => setShipment(event.target.value)} />
        {inTransit && <>
          <Label htmlFor="request-transition-arrival">Дата прихода *</Label>
          <Input id="request-transition-arrival" type="date" min={shipment || undefined} value={arrival} onChange={event => setArrival(event.target.value)} />
          <Label htmlFor="request-transition-carrier">Транспортная компания *</Label>
          <Input id="request-transition-carrier" value={carrier} onChange={event => setCarrier(event.target.value)} />
        </>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={onClose}>Отмена</Button>
        <Button disabled={saving || !shipment || (inTransit && (!arrival || arrival < shipment || !carrier.trim()))} onClick={() => void save()}>
          {saving ? "Сохраняем…" : "Сохранить статус"}
        </Button>
      </DialogFooter>
    </>}
  </DialogContent>;
}
