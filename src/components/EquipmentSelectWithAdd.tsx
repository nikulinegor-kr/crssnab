import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Search, Plus, Truck } from "lucide-react";

interface EquipmentSelectWithAddProps {
  value: string;
  onChange: (value: string) => void;
  organizationId: string | null;
  disabled?: boolean;
}

export const EquipmentSelectWithAdd = ({
  value,
  onChange,
  organizationId,
  disabled = false,
}: EquipmentSelectWithAddProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newVin, setNewVin] = useState("");
  const [newYear, setNewYear] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: equipmentList = [] } = useQuery({
    queryKey: ["equipment", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, year, vin, plate_number")
        .eq("organization_id", organizationId!)
        .order("brand")
        .order("model");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const formatEquipment = (e: any) => {
    const parts = [
      [e.brand, e.model].filter(Boolean).join(" "),
      e.year,
      e.vin ? `VIN ${e.vin}` : null,
    ].filter(Boolean);
    return parts.join(" • ");
  };

  const filtered = useMemo(() => {
    if (!search) return equipmentList;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return equipmentList.filter((e: any) => {
      const haystack = [e.brand, e.model, e.vin, e.plate_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [equipmentList, search]);

  const selectedEquipment = equipmentList.find((e: any) => e.id === value);

  const handleAdd = async () => {
    if (!newBrand || !newModel || !organizationId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("equipment")
        .insert({
          organization_id: organizationId,
          brand: newBrand,
          model: newModel,
          vin: newVin.toUpperCase() || null,
          year: newYear ? parseInt(newYear) : null,
        })
        .select("id")
        .single();
      if (error) {
        const msg = error.message?.includes("equipment_vin_unique")
          ? "Техника с таким VIN уже существует"
          : "Ошибка создания";
        toast({ title: msg, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      onChange(data.id);
      setShowAdd(false);
      setNewBrand(""); setNewModel(""); setNewVin(""); setNewYear("");
      toast({ title: "Техника добавлена" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn("w-full justify-between h-9 text-sm font-normal", !value && "text-muted-foreground")}
          >
            <span className="truncate">
              {selectedEquipment ? formatEquipment(selectedEquipment) : "Выберите технику"}
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Поиск по марке, модели, VIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[250px] overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Не найдено</p>
            ) : (
              filtered.map((e: any) => (
                <button
                  key={e.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer flex items-center gap-2",
                    e.id === value && "bg-accent"
                  )}
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{formatEquipment(e)}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer flex items-center gap-2 text-primary"
              onClick={() => {
                setOpen(false);
                setShowAdd(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить технику
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новая техника</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Марка *</Label>
                <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="CAT, IVECO..." className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Модель *</Label>
                <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="320, Daily..." className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">VIN</Label>
              <Input value={newVin} onChange={(e) => setNewVin(e.target.value.toUpperCase())} placeholder="VIN номер" className="h-9 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Год выпуска</Label>
              <Input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="2019" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!newBrand || !newModel || saving} size="sm">
              {saving ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
