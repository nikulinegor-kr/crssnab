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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Package, Pencil, Trash2, Filter, Download, Upload, AlertTriangle, History, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export default function NomenclaturePage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [unit, setUnit] = useState("шт");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [minStock, setMinStock] = useState<number>(0);
  const [detailProduct, setDetailProduct] = useState<any>(null);

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

  // Stock data for min_stock warnings
  const { data: stockData = {} } = useQuery({
    queryKey: ["all-stock", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("product_id, type, quantity")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        if (!map[m.product_id]) map[m.product_id] = 0;
        switch (m.type) {
          case "IN": case "MOVE_IN": map[m.product_id] += m.quantity; break;
          case "OUT": case "MOVE_OUT": map[m.product_id] -= m.quantity; break;
          case "RESERVE": map[m.product_id] -= m.quantity; break;
          case "UNRESERVE": map[m.product_id] += m.quantity; break;
        }
      });
      return map;
    },
    enabled: !!currentOrgId,
  });

  const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))].sort();

  const filtered = products.filter((p: any) => {
    const matchesSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.article?.toLowerCase().includes(search.toLowerCase());
    const matchesEquipment = equipmentFilter === "all" ||
      (equipmentFilter === "none" ? !p.equipment_id : p.equipment_id === equipmentFilter);
    const matchesCategory = categoryFilter === "all" ||
      (categoryFilter === "none" ? !p.category : p.category === categoryFilter);
    return matchesSearch && matchesEquipment && matchesCategory;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name,
        article: article || null,
        unit,
        equipment_id: equipmentId || null,
        category: category || null,
        min_stock: minStock || 0,
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
    setCategory("");
    setMinStock(0);
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setArticle(p.article || "");
    setUnit(p.unit || "шт");
    setEquipmentId(p.equipment_id || "");
    setCategory(p.category || "");
    setMinStock(p.min_stock || 0);
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

  // Export
  const handleExport = () => {
    const rows = filtered.map((p: any) => ({
      "Название": p.name,
      "Артикул": p.article || "",
      "Категория": p.category || "",
      "Техника": getEquipmentLabel(p) || "",
      "Ед. изм.": p.unit || "шт",
      "Мин. остаток": p.min_stock || 0,
      "Текущий остаток": (stockData as any)[p.id] || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Номенклатура");
    XLSX.writeFile(wb, "nomenclature.xlsx");
    toast({ title: "Экспорт завершён" });
  };

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    let imported = 0;
    for (const row of rows) {
      const prodName = row["Название"] || row["name"] || row["Name"];
      if (!prodName) continue;
      const { error } = await supabase.from("warehouse_products").insert({
        organization_id: currentOrgId!,
        name: prodName,
        article: row["Артикул"] || row["article"] || null,
        category: row["Категория"] || row["category"] || null,
        unit: row["Ед. изм."] || row["unit"] || "шт",
        min_stock: parseInt(row["Мин. остаток"] || row["min_stock"] || "0") || 0,
      });
      if (!error) imported++;
    }
    queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
    toast({ title: `Импортировано: ${imported} товаров` });
    e.target.value = "";
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Номенклатура</h1>
          <span className="text-muted-foreground text-sm">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Добавить товар
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" /> Импорт
              </span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Экспорт
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
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
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Техника" />
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              <SelectItem value="none">Без категории</SelectItem>
              {categories.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Техника</TableHead>
              <TableHead>Ед. изм.</TableHead>
              <TableHead>Мин. остаток</TableHead>
              <TableHead>Остаток</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Нет товаров
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => {
                const currentStock = (stockData as any)[p.id] || 0;
                const isLow = p.min_stock > 0 && currentStock < p.min_stock;
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailProduct(p)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {p.name}
                        {isLow && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.article || "—"}</TableCell>
                    <TableCell>
                      {p.category ? (
                        <Badge variant="outline" className="font-normal">{p.category}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {getEquipmentLabel(p) ? (
                        <Badge variant="secondary" className="font-normal">{getEquipmentLabel(p)}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{p.unit || "шт"}</TableCell>
                    <TableCell>{p.min_stock || "—"}</TableCell>
                    <TableCell>
                      <span className={isLow ? "text-destructive font-semibold" : ""}>
                        {currentStock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
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
              <Label>Категория</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Фильтры, масла, подшипники..." />
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Единица измерения</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="шт" />
              </div>
              <div>
                <Label>Минимальный остаток</Label>
                <Input
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
              {editingId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(open) => !open && setDetailProduct(null)}
        currentOrgId={currentOrgId}
        stockData={stockData}
        onEdit={(p: any) => { setDetailProduct(null); openEdit(p); }}
        onDelete={(id: string) => { setDetailProduct(null); deleteMutation.mutate(id); }}
      />
    </div>
  );
}

// Product detail dialog with tabs for movements and procurement history
function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  currentOrgId,
  stockData,
  onEdit,
  onDelete,
}: {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrgId: string | null;
  stockData: any;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
}) {
  if (!product) return null;

  const currentStock = stockData[product.id] || 0;
  const isLow = product.min_stock > 0 && currentStock < product.min_stock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product.name}
            {product.article && <span className="text-muted-foreground font-normal text-sm">({product.article})</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Остаток</p>
              <p className={`text-xl font-bold ${isLow ? "text-destructive" : ""}`}>{currentStock}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Мин. остаток</p>
              <p className="text-xl font-bold">{product.min_stock || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Ед. изм.</p>
              <p className="text-xl font-bold">{product.unit || "шт"}</p>
            </CardContent>
          </Card>
        </div>

        {isLow && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Нужно заказать — остаток ниже минимального ({currentStock} из {product.min_stock})</span>
          </div>
        )}

        <Tabs defaultValue="movements">
          <TabsList className="w-full">
            <TabsTrigger value="movements" className="flex-1 gap-1">
              <History className="h-3.5 w-3.5" /> Движения
            </TabsTrigger>
            <TabsTrigger value="purchases" className="flex-1 gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Закупки
            </TabsTrigger>
          </TabsList>
          <TabsContent value="movements">
            <MovementHistory productId={product.id} orgId={currentOrgId} />
          </TabsContent>
          <TabsContent value="purchases">
            <PurchaseHistory productId={product.id} orgId={currentOrgId} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Редактировать
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(product.id)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementHistory({ productId, orgId }: { productId: string; orgId: string | null }) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["product-movements", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", productId)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!orgId,
  });

  const typeLabels: Record<string, string> = {
    IN: "Приход",
    OUT: "Расход",
    RESERVE: "Резерв",
    UNRESERVE: "Снятие резерва",
    IN_TRANSIT: "В пути",
    MOVE_IN: "Перемещение (вход)",
    MOVE_OUT: "Перемещение (выход)",
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4 text-center">Загрузка...</p>;
  if (movements.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Нет движений</p>;

  return (
    <div className="max-h-[300px] overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Кол-во</TableHead>
            <TableHead>Комментарий</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m: any) => (
            <TableRow key={m.id}>
              <TableCell className="text-sm">
                {format(new Date(m.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
              </TableCell>
              <TableCell>
                <Badge variant={m.type === "IN" || m.type === "MOVE_IN" ? "default" : "secondary"} className="font-normal text-xs">
                  {typeLabels[m.type] || m.type}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{m.quantity}</TableCell>
              <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{m.comment || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PurchaseHistory({ productId, orgId }: { productId: string; orgId: string | null }) {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["product-purchases", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, amount, created_at, contractor")
        .eq("product_id", productId)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!orgId,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4 text-center">Загрузка...</p>;
  if (requests.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Нет закупок</p>;

  return (
    <div className="max-h-[300px] overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Контрагент</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-sm">{r.request_number}</TableCell>
              <TableCell className="text-sm truncate max-w-[200px]">{r.description}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.contractor || "—"}</TableCell>
              <TableCell className="text-sm">{r.amount ? `${r.amount.toLocaleString()} ₽` : "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal text-xs">{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
