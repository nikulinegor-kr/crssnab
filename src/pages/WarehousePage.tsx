import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, PackagePlus, PackageMinus, ArrowRightLeft, Search, Warehouse } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type MovementType = "IN" | "OUT" | "RESERVE" | "UNRESERVE" | "MOVE_IN" | "MOVE_OUT";

const TYPE_LABELS: Record<string, string> = {
  IN: "Приход",
  OUT: "Списание",
  RESERVE: "Резерв",
  UNRESERVE: "Снятие резерва",
  MOVE_IN: "Перемещение (приход)",
  MOVE_OUT: "Перемещение (расход)",
};

const TYPE_COLORS: Record<string, string> = {
  IN: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OUT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  RESERVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  UNRESERVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MOVE_IN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  MOVE_OUT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function WarehousePage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");

  // Dialog states
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementOpType, setMovementOpType] = useState<"IN" | "OUT" | "MOVE">("IN");

  // Form states
  const [warehouseName, setWarehouseName] = useState("");
  const [productName, setProductName] = useState("");
  const [productArticle, setProductArticle] = useState("");
  const [productUnit, setProductUnit] = useState("шт");
  const [movProductId, setMovProductId] = useState("");
  const [movWarehouseId, setMovWarehouseId] = useState("");
  const [movToWarehouseId, setMovToWarehouseId] = useState("");
  const [movQuantity, setMovQuantity] = useState("");
  const [movComment, setMovComment] = useState("");
  const [movRequestId, setMovRequestId] = useState("");

  // Queries
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["warehouse-products", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_products")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, warehouse_products(name, article), warehouses(name), requests(request_number, description)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Compute stock levels from movements
  const stockLevels = useMemo(() => {
    const map = new Map<string, { product: any; warehouse: any; stock: number; reserve: number }>();

    for (const m of movements) {
      const key = `${m.product_id}__${m.warehouse_id}`;
      if (!map.has(key)) {
        map.set(key, {
          product: m.warehouse_products,
          warehouse: m.warehouses,
          stock: 0,
          reserve: 0,
        });
      }
      const entry = map.get(key)!;
      switch (m.type) {
        case "IN":
        case "MOVE_IN":
          entry.stock += m.quantity;
          break;
        case "OUT":
        case "MOVE_OUT":
          entry.stock -= m.quantity;
          break;
        case "RESERVE":
          entry.reserve += m.quantity;
          break;
        case "UNRESERVE":
          entry.reserve -= m.quantity;
          break;
      }
    }

    return Array.from(map.values()).filter(
      (e) => e.stock !== 0 || e.reserve !== 0
    );
  }, [movements]);

  const filteredStock = useMemo(() => {
    if (!search) return stockLevels;
    const q = search.toLowerCase();
    return stockLevels.filter(
      (s) =>
        s.product?.name?.toLowerCase().includes(q) ||
        s.product?.article?.toLowerCase().includes(q) ||
        s.warehouse?.name?.toLowerCase().includes(q)
    );
  }, [stockLevels, search]);

  const filteredMovements = useMemo(() => {
    if (!movementSearch) return movements;
    const q = movementSearch.toLowerCase();
    return movements.filter(
      (m: any) =>
        m.warehouse_products?.name?.toLowerCase().includes(q) ||
        m.warehouses?.name?.toLowerCase().includes(q) ||
        m.comment?.toLowerCase().includes(q) ||
        TYPE_LABELS[m.type]?.toLowerCase().includes(q)
    );
  }, [movements, movementSearch]);

  // Mutations
  const createWarehouse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouses").insert({
        organization_id: currentOrgId!,
        name: warehouseName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setShowWarehouseDialog(false);
      setWarehouseName("");
      toast({ title: "Склад создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouse_products").insert({
        organization_id: currentOrgId!,
        name: productName,
        article: productArticle || null,
        unit: productUnit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      setShowProductDialog(false);
      setProductName("");
      setProductArticle("");
      setProductUnit("шт");
      toast({ title: "Товар создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const createMovement = useMutation({
    mutationFn: async () => {
      const qty = parseInt(movQuantity);
      if (!qty || qty <= 0) throw new Error("Invalid quantity");

      const base = {
        organization_id: currentOrgId!,
        product_id: movProductId,
        quantity: qty,
        comment: movComment || null,
        request_id: movRequestId || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (movementOpType === "MOVE") {
        // Create two entries
        const { error: e1 } = await supabase.from("stock_movements").insert({
          ...base,
          warehouse_id: movWarehouseId,
          type: "MOVE_OUT",
        });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("stock_movements").insert({
          ...base,
          warehouse_id: movToWarehouseId,
          type: "MOVE_IN",
        });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.from("stock_movements").insert({
          ...base,
          warehouse_id: movWarehouseId,
          type: movementOpType,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowMovementDialog(false);
      resetMovementForm();
      toast({ title: "Операция выполнена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const resetMovementForm = () => {
    setMovProductId("");
    setMovWarehouseId("");
    setMovToWarehouseId("");
    setMovQuantity("");
    setMovComment("");
    setMovRequestId("");
  };

  const openMovementDialog = (type: "IN" | "OUT" | "MOVE") => {
    setMovementOpType(type);
    resetMovementForm();
    setShowMovementDialog(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Склад и остатки</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowWarehouseDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Склад
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowProductDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Товар
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Остатки</TabsTrigger>
          <TabsTrigger value="movements">Журнал движений</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по товару, артикулу, складу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => openMovementDialog("IN")} size="sm">
                <PackagePlus className="h-4 w-4 mr-1" /> Приход
              </Button>
              <Button onClick={() => openMovementDialog("OUT")} size="sm" variant="secondary">
                <PackageMinus className="h-4 w-4 mr-1" /> Списание
              </Button>
              <Button onClick={() => openMovementDialog("MOVE")} size="sm" variant="outline">
                <ArrowRightLeft className="h-4 w-4 mr-1" /> Перемещение
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Склад</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                  <TableHead className="text-right">Резерв</TableHead>
                  <TableHead className="text-right">Доступно</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Нет данных об остатках
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStock.map((s, i) => {
                    const available = s.stock - s.reserve;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.product?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.product?.article || "—"}</TableCell>
                        <TableCell>{s.warehouse?.name || "—"}</TableCell>
                        <TableCell className="text-right">{s.stock}</TableCell>
                        <TableCell className="text-right">{s.reserve}</TableCell>
                        <TableCell className={`text-right font-semibold ${available < 0 ? "text-destructive" : ""}`}>
                          {available}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по товару, складу, комментарию..."
              value={movementSearch}
              onChange={(e) => setMovementSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Тип операции</TableHead>
                  <TableHead className="text-right">Количество</TableHead>
                  <TableHead>Склад</TableHead>
                  <TableHead>Связанная заявка</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Нет движений
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(m.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell className="font-medium">{m.warehouse_products?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={TYPE_COLORS[m.type] || ""}>
                          {TYPE_LABELS[m.type] || m.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.quantity}</TableCell>
                      <TableCell>{m.warehouses?.name || "—"}</TableCell>
                      <TableCell>
                        {m.requests ? (
                          <button
                            className="text-primary hover:underline text-sm"
                            onClick={() => navigate(`/requests/${m.request_id}`)}
                          >
                            {m.requests.description || `#${m.requests.request_number}`}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {m.comment || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый склад</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} placeholder="Основной склад" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createWarehouse.mutate()} disabled={!warehouseName || createWarehouse.isPending}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый товар</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Название товара" />
            </div>
            <div>
              <Label>Артикул</Label>
              <Input value={productArticle} onChange={(e) => setProductArticle(e.target.value)} placeholder="ART-001" />
            </div>
            <div>
              <Label>Единица измерения</Label>
              <Input value={productUnit} onChange={(e) => setProductUnit(e.target.value)} placeholder="шт" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createProduct.mutate()} disabled={!productName || createProduct.isPending}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementOpType === "IN" ? "Приход" : movementOpType === "OUT" ? "Списание" : "Перемещение"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Товар</Label>
              <Select value={movProductId} onValueChange={setMovProductId}>
                <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.article ? `(${p.article})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{movementOpType === "MOVE" ? "Со склада" : "Склад"}</Label>
              <Select value={movWarehouseId} onValueChange={setMovWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Выберите склад" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {movementOpType === "MOVE" && (
              <div>
                <Label>На склад</Label>
                <Select value={movToWarehouseId} onValueChange={setMovToWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Выберите склад" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.filter((w: any) => w.id !== movWarehouseId).map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Количество</Label>
              <Input type="number" min="1" value={movQuantity} onChange={(e) => setMovQuantity(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Комментарий</Label>
              <Textarea value={movComment} onChange={(e) => setMovComment(e.target.value)} placeholder="Опционально" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMovement.mutate()}
              disabled={
                !movProductId ||
                !movWarehouseId ||
                !movQuantity ||
                (movementOpType === "MOVE" && !movToWarehouseId) ||
                createMovement.isPending
              }
            >
              Выполнить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
