import { useEffect, useMemo, useState } from "react";
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
import type { FilterElementRow } from "@/hooks/useFilterElements";
import { PartAiSuggestions } from "@/components/erp/PartAiSuggestions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  item?: FilterElementRow | null;
}

export function FilterElementFormDialog({ open, onOpenChange, orgId, item }: Props) {
  const qc = useQueryClient();
  const editing = !!item;

  const [form, setForm] = useState({
    name: "",
    article: "",
    manufacturer: "",
    unit: "шт",
    storage_location: "",
    notes: "",
  });
  const [crossNums, setCrossNums] = useState<string[]>([]);
  const [crossInput, setCrossInput] = useState("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [eqSearch, setEqSearch] = useState("");

  // Оприходование (только при создании)
  const [receipt, setReceipt] = useState({
    quantity: "",
    unit_price: "",
    supplier: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    document_number: "",
    comment: "",
  });

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name ?? "",
        article: item.article ?? "",
        manufacturer: item.manufacturer ?? "",
        unit: item.unit ?? "шт",
        storage_location: item.storage_location ?? "",
        notes: item.notes ?? "",
      });
      setCrossNums(item.cross_numbers ?? []);
      (async () => {
        const { data } = await (supabase as any)
          .from("filter_element_equipment")
          .select("equipment_id")
          .eq("filter_element_id", item.id);
        setEquipmentIds((data ?? []).map((d: any) => d.equipment_id));
      })();
    } else {
      setForm({ name: "", article: "", manufacturer: "", unit: "шт", storage_location: "", notes: "" });
      setCrossNums([]);
      setEquipmentIds([]);
    }
    setReceipt({
      quantity: "",
      unit_price: "",
      supplier: "",
      receipt_date: new Date().toISOString().slice(0, 10),
      document_number: "",
      comment: "",
    });
    setCrossInput("");
    setEqSearch("");
  }, [open, item]);


  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-for-filters", orgId],
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

  const filteredEquipment = useMemo(() => {
    const q = eqSearch.trim().toLowerCase();
    if (!q) return equipment as any[];
    const words = q.split(/\s+/).filter(Boolean);
    return (equipment as any[]).filter((e) => {
      const hay = [e.brand, e.model, e.plate_number, e.year].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [equipment, eqSearch]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Название обязательно");
      const payload: any = {
        organization_id: orgId,
        name: form.name.trim(),
        article: form.article.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        unit: form.unit || "шт",
        storage_location: form.storage_location.trim() || null,
        notes: form.notes.trim() || null,
        cross_numbers: crossNums,
      };
      let id = item?.id;
      if (editing && id) {
        const { error } = await (supabase as any).from("filter_elements").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("filter_elements").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (id) {
        await (supabase as any).from("filter_element_equipment").delete().eq("filter_element_id", id);
        if (equipmentIds.length) {
          await (supabase as any)
            .from("filter_element_equipment")
            .insert(equipmentIds.map((eid) => ({ filter_element_id: id, equipment_id: eid })));
        }
      }
      // Первичное оприходование — только при создании и если указано количество
      if (!editing && id) {
        const q = Number(receipt.quantity);
        if (q && q > 0) {
          const price = receipt.unit_price.trim() ? Number(receipt.unit_price) : null;
          if (price != null && (Number.isNaN(price) || price < 0)) {
            throw new Error("Цена должна быть неотрицательной");
          }
          const { error: mErr } = await (supabase as any).from("filter_element_movements").insert({
            organization_id: orgId,
            filter_element_id: id,
            type: "IN",
            quantity: q,
            unit_price: price,
            supplier: receipt.supplier.trim() || null,
            document_number: receipt.document_number.trim() || null,
            receipt_date: receipt.receipt_date ? new Date(receipt.receipt_date).toISOString() : null,
            comment: receipt.comment.trim() || null,
          });
          if (mErr) throw mErr;
        }
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
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
          <DialogTitle>{editing ? "Редактировать фильтр" : "Новый фильтр"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <PartAiSuggestions
            orgId={orgId}
            kind="filter"
            article={form.article}
            crossNumbers={crossNums}
            name={form.name}
            manufacturer={form.manufacturer}
            excludeId={item?.id}
            onOpenDuplicate={(id) => {
              window.dispatchEvent(new CustomEvent("open-part-detail", { detail: { kind: "filter", id } }));
              onOpenChange(false);
            }}
            onMoveToDeadstock={async () => {
              if (!form.name.trim()) { toast.error("Укажите наименование"); return; }
              const { error } = await (supabase as any).from("filter_element_deadstock").insert({
                organization_id: orgId,
                name: form.name.trim(),
                article: form.article.trim() || null,
                manufacturer: form.manufacturer.trim() || null,
                cross_numbers: crossNums,
                compatibility: null,
                quantity: 0,
                unit: form.unit || "шт",
                status: "for_sale",
                notes: "Создано из формы: совместимость с техникой не найдена",
              });
              if (error) { toast.error(error.message); return; }
              qc.invalidateQueries({ queryKey: ["filter-element-deadstock"] });
              toast.success("Позиция создана в складе неликвида");
              onOpenChange(false);
            }}
            onAccept={(d) => {
              setForm((f) => ({
                ...f,
                manufacturer: d.manufacturer || f.manufacturer,
                name: d.name || f.name,
                article: d.article || f.article,
              }));
              if (d.cross_numbers?.length) {
                setCrossNums((prev) => Array.from(new Set([...prev, ...d.cross_numbers!])));
              }
              if (d.equipment_ids?.length) {
                setEquipmentIds((prev) => Array.from(new Set([...prev, ...d.equipment_ids!])));
              }
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Наименование фильтра *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Производитель</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            </div>
            <div>
              <Label>Артикул</Label>
              <Input value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })} />
            </div>
            <div>
              <Label>Ед. изм.</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Мин. остаток</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Место хранения</Label>
              <Input value={form.storage_location} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} />
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

          <div>
            <Label>Совместимость с техникой</Label>
            <Input
              placeholder="Поиск техники..."
              value={eqSearch}
              onChange={(e) => setEqSearch(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded-md p-2 max-h-56 overflow-y-auto space-y-1">
              {filteredEquipment.length === 0 && <div className="text-sm text-muted-foreground">Нет техники</div>}
              {filteredEquipment.map((e: any) => (
                <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 text-sm">
                  <input type="checkbox" checked={equipmentIds.includes(e.id)} onChange={() => toggleEq(e.id)} />
                  <span>
                    {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""} {e.year ? `(${e.year})` : ""}
                  </span>
                </label>
              ))}
            </div>
            {equipmentIds.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">Выбрано: {equipmentIds.length}</div>
            )}
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
