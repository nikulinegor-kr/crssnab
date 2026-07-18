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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  filterElementId: string;
  filterName: string;
  currentStock: number;
}

export function FilterElementWriteOffDialog({ open, onOpenChange, orgId, filterElementId, filterName, currentStock }: Props) {
  const qc = useQueryClient();
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [responsibleId, setResponsibleId] = useState<string>("");
  const [objectId, setObjectId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setEquipmentId(""); setResponsibleId(""); setObjectId(""); setQty(""); setReason(""); setComment("");
    }
  }, [open]);


  // Only compatible equipment
  const { data: compatibleEquipment = [] } = useQuery({
    queryKey: ["filter-compat-equipment", filterElementId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("filter_element_equipment")
        .select("equipment:equipment_id(id, brand, model, plate_number)")
        .eq("filter_element_id", filterElementId);
      return (data ?? []).map((d: any) => d.equipment).filter(Boolean);
    },
    enabled: open && !!filterElementId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["org-profiles", orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_organizations")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("organization_id", orgId);
      return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
    },
    enabled: open && !!orgId,
  });

  const { data: objects = [] } = useQuery({
    queryKey: ["org-objects-filters", orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      return data ?? [];
    },
    enabled: open && !!orgId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!equipmentId) throw new Error("Выберите технику");
      if (!responsibleId) throw new Error("Выберите ответственного");
      if (!objectId) throw new Error("Выберите объект");
      if (!q || q <= 0) throw new Error("Количество должно быть больше 0");
      if (q > currentStock) throw new Error(`Недостаточно на складе (остаток ${currentStock})`);
      if (!reason.trim()) throw new Error("Укажите причину списания");
      const { error } = await (supabase as any).from("filter_element_movements").insert({
        organization_id: orgId,
        filter_element_id: filterElementId,
        type: "WRITE_OFF",
        quantity: q,
        equipment_id: equipmentId,
        responsible_user_id: responsibleId,
        object_id: objectId,
        reason: reason.trim(),
        comment: comment.trim() || null,
      });
      if (error) throw error;

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      qc.invalidateQueries({ queryKey: ["filter-element-movements"] });
      toast.success("Списано");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Списание — {filterName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Остаток: <span className="font-numeric">{currentStock}</span></div>

          <div>
            <Label>Техника (из совместимости) *</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger><SelectValue placeholder="Выберите технику" /></SelectTrigger>
              <SelectContent>
                {(compatibleEquipment as any[]).length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Нет совместимой техники. Добавьте её в карточке фильтра.</div>
                ) : (
                  (compatibleEquipment as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ответственный *</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger>
              <SelectContent>
                {(profiles as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Объект *</Label>
            <Select value={objectId} onValueChange={setObjectId}>
              <SelectTrigger><SelectValue placeholder="Выберите объект" /></SelectTrigger>
              <SelectContent>
                {(objects as any[]).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Количество *</Label>
            <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div>
            <Label>Причина списания *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Износ, замена по регламенту, брак..." />
          </div>

          <div>
            <Label>Комментарий</Label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Списание..." : "Списать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
