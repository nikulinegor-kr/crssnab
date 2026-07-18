import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { SparePartRow } from "@/hooks/useSpareParts";
import { PartAiSuggestions } from "@/components/erp/PartAiSuggestions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  part?: SparePartRow | null;
}

const DEFAULT_CATEGORIES = ["Двигатель", "Ходовая", "Тормоза", "Электрика", "Кузов", "Гидравлика", "Расходники"];

export function SparePartFormDialog({ open, onOpenChange, orgId, part }: Props) {
  const qc = useQueryClient();
  const editing = !!part;

  const [form, setForm] = useState({
    name: "",
    article: "",
    manufacturer: "",
    category: "",
    unit: "шт",
    min_stock: "0",
    storage_location: "",
    rack: "",
    shelf: "",
    cell: "",
    purchase_price: "",
    price: "",
    notes: "",
  });
  const [crossNums, setCrossNums] = useState<string[]>([]);
  const [crossInput, setCrossInput] = useState("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (part) {
      setForm({
        name: part.name ?? "",
        article: part.article ?? "",
        manufacturer: (part as any).manufacturer ?? "",
        category: part.category ?? "",
        unit: part.unit ?? "шт",
        min_stock: String((part as any).min_stock ?? 0),
        storage_location: (part as any).storage_location ?? "",
        rack: (part as any).rack ?? "",
        shelf: (part as any).shelf ?? "",
        cell: (part as any).cell ?? "",
        purchase_price: (part as any).purchase_price ? String((part as any).purchase_price) : "",
        price: part.price ? String(part.price) : "",
        notes: part.notes ?? "",
      });
      setCrossNums(((part as any).cross_numbers ?? []) as string[]);
      (async () => {
        const { data } = await (supabase as any)
          .from("spare_part_equipment")
          .select("equipment_id")
          .eq("spare_part_id", part.id);
        setEquipmentIds((data ?? []).map((d: any) => d.equipment_id));
      })();
    } else {
      setForm({ name: "", article: "", manufacturer: "", category: "", unit: "шт", min_stock: "0", storage_location: "", rack: "", shelf: "", cell: "", purchase_price: "", price: "", notes: "" });
      setCrossNums([]);
      setEquipmentIds([]);
    }
  }, [open, part]);

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-for-parts", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipment")
        .select("id, brand, model, plate_number, year")
        .eq("organization_id", orgId)
        .order("brand");
      return data ?? [];
    },
    enabled: !!orgId && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Название обязательно");
      const payload: any = {
        organization_id: orgId,
        name: form.name.trim(),
        article: form.article.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        category: form.category.trim() || null,
        unit: form.unit || "шт",
        min_stock: Number(form.min_stock) || 0,
        storage_location: form.storage_location.trim() || null,
        rack: form.rack.trim() || null,
        shelf: form.shelf.trim() || null,
        cell: form.cell.trim() || null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        price: form.price ? Number(form.price) : null,
        notes: form.notes.trim() || null,
        cross_numbers: crossNums,
      };
      let partId = part?.id;
      if (editing && partId) {
        const { error } = await (supabase as any).from("spare_parts").update(payload).eq("id", partId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("spare_parts").insert(payload).select("id").single();
        if (error) throw error;
        partId = data.id;
      }
      // sync compatibility
      if (partId) {
        await (supabase as any).from("spare_part_equipment").delete().eq("spare_part_id", partId);
        if (equipmentIds.length) {
          await (supabase as any).from("spare_part_equipment").insert(
            equipmentIds.map((eid) => ({ spare_part_id: partId, equipment_id: eid, organization_id: orgId }))
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spare-parts-list"] });
      qc.invalidateQueries({ queryKey: ["spare-part-equipment"] });
      toast.success(editing ? "Обновлено" : "Добавлено");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  const addCross = () => {
    const v = crossInput.trim();
    if (v && !crossNums.includes(v)) setCrossNums([...crossNums, v]);
    setCrossInput("");
  };

  const toggleEq = (id: string) =>
    setEquipmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Редактировать запчасть" : "Новая запчасть"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Название *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Артикул</Label>
              <Input value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })} />
            </div>
            <div>
              <Label>Производитель</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div>
              <Label>Категория</Label>
              <Input
                list="sp-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="sp-categories">
                {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label>Ед. изм.</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Мин. остаток</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div>
              <Label>Цена закупки</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <Label>Цена продажи</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Кросс-номера</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Добавить номер"
                value={crossInput}
                onChange={(e) => setCrossInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCross(); } }}
              />
              <Button type="button" variant="outline" onClick={addCross}>Добавить</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {crossNums.map((c) => (
                <Badge key={c} variant="secondary" className="gap-1">
                  {c}
                  <button type="button" onClick={() => setCrossNums(crossNums.filter((x) => x !== c))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Склад</Label>
              <Input value={form.storage_location} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} />
            </div>
            <div>
              <Label>Стеллаж</Label>
              <Input value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })} />
            </div>
            <div>
              <Label>Полка</Label>
              <Input value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} />
            </div>
            <div>
              <Label>Ячейка</Label>
              <Input value={form.cell} onChange={(e) => setForm({ ...form, cell: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Совместимая техника</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
              {equipment.length === 0 && <div className="text-sm text-muted-foreground">Нет техники</div>}
              {equipment.map((e: any) => (
                <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={equipmentIds.includes(e.id)}
                    onChange={() => toggleEq(e.id)}
                  />
                  <span>
                    {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""} {e.year ? `(${e.year})` : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Примечание</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
