import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Pencil, Trash2, Filter } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function NomenclaturePage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [unit, setUnit] = useState("шт");
  const [equipmentId, setEquipmentId] = useState<string>("");

  const { data: products = [] } = useQuery({
    queryKey: ["warehouse-products", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_products")
        .select("*, equipment:equipment_id(id, brand, model)")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("brand")
        .order("model");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const filtered = products.filter((p: any) => {
    const matchesSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.article?.toLowerCase().includes(search.toLowerCase());
    const matchesEquipment = equipmentFilter === "all" ||
      (equipmentFilter === "none" ? !p.equipment_id : p.equipment_id === equipmentFilter);
    return matchesSearch && matchesEquipment;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        article: article || null,
        unit,
        equipment_id: equipmentId || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("warehouse_products")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouse_products").insert({
          organization_id: currentOrgId!,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      closeDialog();
      toast({ title: editingId ? "Товар обновлён" : "Товар создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      toast({ title: "Товар удалён" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setArticle("");
    setUnit("шт");
    setEquipmentId("");
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setArticle(p.article || "");
    setUnit(p.unit || "шт");
    setEquipmentId(p.equipment_id || "");
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  const getEquipmentLabel = (p: any) => {
    if (!p.equipment) return null;
    return `${p.equipment.brand} ${p.equipment.model}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Номенклатура</h1>
          <span className="text-muted-foreground text-sm">({filtered.length})</span>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Добавить товар
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или артикулу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Все техника" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Вся техника</SelectItem>
              <SelectItem value="none">Без техники</SelectItem>
              {equipment.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.brand} {e.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Техника</TableHead>
              <TableHead>Ед. изм.</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Нет товаров
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.article || "—"}</TableCell>
                  <TableCell>
                    {getEquipmentLabel(p) ? (
                      <Badge variant="secondary" className="font-normal">
                        {getEquipmentLabel(p)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{p.unit || "шт"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(p.created_at), "dd.MM.yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMutation.mutate(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать товар" : "Новый товар"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название товара" />
            </div>
            <div>
              <Label>Артикул</Label>
              <Input value={article} onChange={(e) => setArticle(e.target.value)} placeholder="ART-001" />
            </div>
            <div>
              <Label>Техника</Label>
              <Select value={equipmentId || "none"} onValueChange={(v) => setEquipmentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите технику" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без техники</SelectItem>
                  {equipment.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.brand} {e.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Единица измерения</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="шт" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
              {editingId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
