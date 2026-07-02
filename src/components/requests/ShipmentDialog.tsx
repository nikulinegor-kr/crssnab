import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package, Sparkles, Loader2 } from "lucide-react";
import {
  SHIPMENT_STATUSES,
  TRANSPORT_TYPES,
  type RequestShipment,
  type ShipmentItem,
  type ShipmentStatus,
  type TransportType,
  useShipmentItems,
  useUpsertShipment,
  useUpsertShipmentItem,
  useDeleteShipmentItem,
} from "@/hooks/useRequestShipments";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
  organizationId: string;
  shipment?: RequestShipment | null;
}

interface DraftItem {
  id?: string;
  material_name: string;
  quantity: string;
  unit: string;
}

export function ShipmentDialog({ open, onOpenChange, requestId, organizationId, shipment }: Props) {
  const upsert = useUpsertShipment();
  const upsertItem = useUpsertShipmentItem();
  const deleteItem = useDeleteShipmentItem();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: existingItems = [] } = useShipmentItems(shipment?.id ?? null);

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
  const [items, setItems] = useState<DraftItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRecognize = async (file: File) => {
    setRecognizing(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("recognize-shipment", {
        body: { file: dataUrl, fileType: file.type },
      });
      if (error) throw error;
      if (data?.transport_company) setTransportCompany(data.transport_company);
      if (data?.vehicle_number) setVehicleNumber(data.vehicle_number);
      if (data?.trailer_number) setTrailerNumber(data.trailer_number);
      if (data?.driver_name) setDriverName(data.driver_name);
      if (data?.driver_phone) setDriverPhone(data.driver_phone);
      if (data?.waybill_number) setWaybillNumber(data.waybill_number);
      if (data?.load_date) setLoadDate(data.load_date);
      if (data?.planned_arrival_date) setPlannedDate(data.planned_arrival_date);
      if (Array.isArray(data?.items) && data.items.length) {
        const recognized: DraftItem[] = data.items
          .filter((i: any) => i?.material_name)
          .map((i: any) => ({
            material_name: String(i.material_name),
            quantity: i.quantity != null ? String(i.quantity) : "",
            unit: i.unit || "шт",
          }));
        setItems((prev) => [...prev, ...recognized]);
      }
      toast({ title: "Данные распознаны", description: "Проверьте и сохраните" });
    } catch (e: any) {
      toast({ title: "Ошибка распознавания", description: e.message, variant: "destructive" });
    } finally {
      setRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
    setDeletedIds([]);
  }, [open, shipment]);

  useEffect(() => {
    if (!open) return;
    if (shipment?.id) {
      setItems(
        existingItems.map((i) => ({
          id: i.id,
          material_name: i.material_name,
          quantity: i.quantity != null ? String(i.quantity) : "",
          unit: i.unit ?? "шт",
        }))
      );
    } else {
      setItems([]);
    }
  }, [open, shipment?.id, existingItems.length]);

  const addRow = () => setItems((p) => [...p, { material_name: "", quantity: "", unit: "шт" }]);
  const updateRow = (idx: number, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => {
    setItems((p) => {
      const row = p[idx];
      if (row.id) setDeletedIds((d) => [...d, row.id!]);
      return p.filter((_, i) => i !== idx);
    });
  };

  const saveItems = async (shipmentId: string) => {
    for (const id of deletedIds) {
      await (supabase as any).from("shipment_items").delete().eq("id", id);
    }
    for (const row of items) {
      const name = row.material_name.trim();
      if (!name) continue;
      const payload: any = {
        shipment_id: shipmentId,
        organization_id: organizationId,
        material_name: name,
        quantity: row.quantity ? Number(row.quantity) : null,
        unit: row.unit || null,
      };
      if (row.id) {
        await (supabase as any).from("shipment_items").update(payload).eq("id", row.id);
      } else {
        await (supabase as any).from("shipment_items").insert(payload);
      }
    }
    qc.invalidateQueries({ queryKey: ["shipment-items", shipmentId] });
  };

  const handleSave = async () => {
    try {
      const saved = await upsert.mutateAsync({
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
      await saveItems((saved as any).id);
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

          {/* Materials */}
          <div className="sm:col-span-2 space-y-2 border-t pt-3 mt-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Материалы в перевозке
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Добавить
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">Нет материалов</div>
            ) : (
              <div className="space-y-2">
                {items.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-7 h-9"
                      placeholder="Наименование"
                      value={row.material_name}
                      onChange={(e) => updateRow(idx, { material_name: e.target.value })}
                    />
                    <Input
                      className="col-span-2 h-9"
                      type="number"
                      placeholder="Кол-во"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                    />
                    <Input
                      className="col-span-2 h-9"
                      placeholder="ед."
                      value={row.unit}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-9 w-9"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button type="button" onClick={handleSave} disabled={upsert.isPending}>
            {shipment ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
