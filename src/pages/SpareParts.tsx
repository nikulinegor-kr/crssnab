import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SparePart {
  id: string;
  article: string;
  name: string;
  category: string | null;
  equipment_type: string | null;
  equipment_model: string | null;
  equipment_number: string | null;
  quantity: number | null;
  price: number | null;
  unit: string | null;
  notes: string | null;
  organization_id: string;
}

const DEFAULT_EQUIPMENT_TYPES = [
  "БУЛЬДОЗЕР",
  "ЭКСКАВАТОР",
  "ПОГРУЗЧИК",
  "АВТОСАМОСВАЛ",
  "ГРЕЙДЕР",
  "КАТОК",
  "КРАН",
  "ДРУГОЕ",
];

const DEFAULT_CATEGORIES = [
  "Фильтры",
  "Ножи и режущие элементы",
  "Расходные материалы",
  "Запчасти двигателя",
  "Гидравлика",
  "Трансмиссия",
  "Ходовая часть",
  "Электрика",
  "Другое",
];

export default function SpareParts() {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEquipmentType, setFilterEquipmentType] = useState<string>("");
  const [filterModel, setFilterModel] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [formData, setFormData] = useState({
    article: "",
    name: "",
    category: "",
    equipment_type: "",
    equipment_model: "",
    equipment_number: "",
    quantity: 1,
    price: "",
    unit: "шт",
    notes: "",
  });

  // Fetch ALL parts for filter options (without filters applied)
  const { data: allParts } = useQuery({
    queryKey: ["spare-parts-all", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("spare_parts")
        .select("equipment_type, equipment_model, category")
        .eq("organization_id", currentOrgId);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Filter options from ALL data (not filtered)
  const equipmentTypes = [...new Set(allParts?.map(p => p.equipment_type).filter(Boolean) || [])].sort() as string[];
  const equipmentModels = [...new Set(allParts?.map(p => p.equipment_model).filter(Boolean) || [])].sort() as string[];
  const categories = [...new Set(allParts?.map(p => p.category).filter(Boolean) || [])].sort() as string[];

  // Combined lists for form dropdowns
  const allEquipmentTypes = [...new Set([...DEFAULT_EQUIPMENT_TYPES, ...equipmentTypes])].sort();
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort();

  const { data: spareParts, isLoading } = useQuery({
    queryKey: ["spare-parts", currentOrgId, searchQuery, filterEquipmentType, filterModel, filterCategory],
    queryFn: async () => {
      if (!currentOrgId) return [];
      
      let query = supabase
        .from("spare_parts")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("equipment_type")
        .order("name");

      if (searchQuery) {
        query = query.or(`article.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }
      if (filterEquipmentType) {
        query = query.eq("equipment_type", filterEquipmentType);
      }
      if (filterModel) {
        query = query.eq("equipment_model", filterModel);
      }
      if (filterCategory) {
        query = query.eq("category", filterCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SparePart[];
    },
    enabled: !!currentOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentOrgId) throw new Error("No organization");
      const { error } = await supabase.from("spare_parts").insert({
        organization_id: currentOrgId,
        article: data.article,
        name: data.name,
        category: data.category || null,
        equipment_type: data.equipment_type || null,
        equipment_model: data.equipment_model || null,
        equipment_number: data.equipment_number || null,
        quantity: data.quantity,
        price: data.price ? parseFloat(data.price) : null,
        unit: data.unit,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Запчасть добавлена");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Ошибка при добавлении");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("spare_parts")
        .update({
          article: data.article,
          name: data.name,
          category: data.category || null,
          equipment_type: data.equipment_type || null,
          equipment_model: data.equipment_model || null,
          equipment_number: data.equipment_number || null,
          quantity: data.quantity,
          price: data.price ? parseFloat(data.price) : null,
          unit: data.unit,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Запчасть обновлена");
      resetForm();
      setIsDialogOpen(false);
      setEditingPart(null);
    },
    onError: () => {
      toast.error("Ошибка при обновлении");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spare_parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      toast.success("Запчасть удалена");
    },
    onError: () => {
      toast.error("Ошибка при удалении");
    },
  });

  const resetForm = () => {
    setFormData({
      article: "",
      name: "",
      category: "",
      equipment_type: "",
      equipment_model: "",
      equipment_number: "",
      quantity: 1,
      price: "",
      unit: "шт",
      notes: "",
    });
    setEditingPart(null);
  };

  const handleEdit = (part: SparePart) => {
    setEditingPart(part);
    setFormData({
      article: part.article,
      name: part.name,
      category: part.category || "",
      equipment_type: part.equipment_type || "",
      equipment_model: part.equipment_model || "",
      equipment_number: part.equipment_number || "",
      quantity: part.quantity || 1,
      price: part.price?.toString() || "",
      unit: part.unit || "шт",
      notes: part.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.article.trim() || !formData.name.trim()) {
      toast.error("Заполните артикул и название");
      return;
    }
    if (editingPart) {
      updateMutation.mutate({ id: editingPart.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const groupedParts = spareParts?.reduce((acc, part) => {
    const type = part.equipment_type || "Без категории";
    if (!acc[type]) acc[type] = [];
    acc[type].push(part);
    return acc;
  }, {} as Record<string, SparePart[]>);

  const hasActiveFilters = filterEquipmentType || filterModel || filterCategory;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Каталог запчастей
            </h1>
            <p className="text-muted-foreground">
              {spareParts?.length || 0} позиций в каталоге
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить запчасть
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPart ? "Редактировать запчасть" : "Новая запчасть"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Артикул *</Label>
                    <Input
                      value={formData.article}
                      onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                      placeholder="1R-0755"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Название *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Топливный фильтр"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Тип техники</Label>
                    <Select
                      value={formData.equipment_type}
                      onValueChange={(v) => setFormData({ ...formData, equipment_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {allEquipmentTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Категория</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Модель техники</Label>
                    <Input
                      value={formData.equipment_model}
                      onChange={(e) => setFormData({ ...formData, equipment_model: e.target.value })}
                      placeholder="CATERPILLAR D10T2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Гос. номер</Label>
                    <Input
                      value={formData.equipment_number}
                      onChange={(e) => setFormData({ ...formData, equipment_number: e.target.value })}
                      placeholder="14 РА 0824"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Цена</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ед. изм.</Label>
                    <Input
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="шт"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Примечания</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Дополнительная информация"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Отмена
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingPart ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по артикулу или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterEquipmentType || "all"} onValueChange={(v) => setFilterEquipmentType(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Тип техники" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    {equipmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterModel || "all"} onValueChange={(v) => setFilterModel(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Модель" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все модели</SelectItem>
                    {equipmentModels.map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={() => {
                    setFilterEquipmentType("");
                    setFilterModel("");
                    setFilterCategory("");
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : !spareParts?.length ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Каталог пуст</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить первую запчасть
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedParts || {}).map(([type, parts]) => (
                  <div key={type}>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Badge variant="secondary">{type}</Badge>
                      <span className="text-sm text-muted-foreground">({parts.length})</span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Артикул</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Модель</TableHead>
                            <TableHead className="text-center">Кол-во</TableHead>
                            <TableHead className="text-right">Цена</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parts.map((part) => (
                            <TableRow key={part.id}>
                              <TableCell className="font-mono text-sm">{part.article}</TableCell>
                              <TableCell>
                                <div>{part.name}</div>
                                {part.category && (
                                  <span className="text-xs text-muted-foreground">{part.category}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {part.equipment_model && (
                                  <div className="text-sm">{part.equipment_model}</div>
                                )}
                                {part.equipment_number && (
                                  <div className="text-xs text-muted-foreground">{part.equipment_number}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{part.quantity} {part.unit}</TableCell>
                              <TableCell className="text-right">
                                {part.price ? `${part.price.toLocaleString()} ₸` : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(part)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(part.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
