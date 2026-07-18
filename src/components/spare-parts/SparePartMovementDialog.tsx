import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { SparePartRow } from "@/hooks/useSpareParts";

type MovementType = "IN" | "WRITE_OFF" | "SALE" | "ADJUST";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: SparePartRow;
  orgId: string;
  type: MovementType;
}

const LABELS: Record<MovementType, string> = {
  IN: "Приход",
  WRITE_OFF: "Списание",
  SALE: "Продажа",
  ADJUST: "Корректировка",
};

export function SparePartMovementDialog({ open, onOpenChange, part, orgId, type }: Props) {
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [objectId, setObjectId] = useState<string>("");
  const [responsible, setResponsible] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setQty("1");
    setEquipmentId("");
    setObjectId("");
    setResponsible("");
    setUnitPrice(type === "IN" ? String((part as any).purchase_price ?? "") : type === "SALE" ? String(part.price ?? "") : "");
    setBuyer("");
    setReason("");
    setComment("");
  }, [open, type, part]);

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-mov", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("equipment").select("id, brand, model, plate_number").eq("organization_id", orgId).order("brand");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: objects = [] } = useQuery({
    queryKey: ["objects-mov", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("request_objects").select("id, name").eq("organization_id", orgId).order("name");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-mov", orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_organizations")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("organization_id", orgId);
      return (data ?? []).map((u: any) => u.profiles).filter(Boolean);
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || q <= 0) throw new Error("Введите количество");
      if (type === "WRITE_OFF" || type === "SALE") {
        if ((part.stock ?? 0) < q) throw new Error(`Недостаточно на складе (доступно ${part.stock ?? 0})`);
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("spare_part_movements").insert({
        organization_id: orgId,
        spare_part_id: part.id,
        type,
        quantity: q,
        equipment_id: equipmentId || null,
        object_id: objectId || null,
        responsible_user_id: responsible || null,
        reason: reason.trim() || null,
        comment: comment.trim() || null,
        unit_price: unitPrice ? Number(unitPrice) : null,
        buyer: type === "SALE" ? (buyer.trim() || null) : null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spare-parts-list"] });
      qc.invalidateQueries({ queryKey: ["spare-part-movements", part.id] });
      toast.success(LABELS[type] + " сохранено");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  const showEquipment = type === "WRITE_OFF" || type === "SALE";
  const showResponsible = type === "WRITE_OFF";
  const showBuyer = type === "SALE";
  const showReason = type === "WRITE_OFF" || type === "ADJUST";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{LABELS[type]} — {part.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Количество *</Label>
              <Input type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <Label>{type === "SALE" ? "Цена продажи" : "Цена, ₽"}</Label>
              <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          </div>

          {showEquipment && (
            <div>
              <Label>Техника</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger><SelectValue placeholder="Не выбрано" /></SelectTrigger>
                <SelectContent>
                  {equipment.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showEquipment && (
            <div>
              <Label>Объект</Label>
              <Select value={objectId} onValueChange={setObjectId}>
                <SelectTrigger><SelectValue placeholder="Не выбрано" /></SelectTrigger>
                <SelectContent>
                  {objects.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showResponsible && (
            <div>
              <Label>Ответственный</Label>
              <Select value={responsible} onValueChange={setResponsible}>
                <SelectTrigger><SelectValue placeholder="Не выбрано" /></SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showBuyer && (
            <div>
              <Label>Покупатель</Label>
              <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} />
            </div>
          )}

          {showReason && (
            <div>
              <Label>Причина</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "WRITE_OFF" ? "Замена, ремонт..." : "Инвентаризация..."} />
            </div>
          )}

          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
