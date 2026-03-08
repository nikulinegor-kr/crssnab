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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, PackagePlus, PackageMinus, ArrowRightLeft, Search, Warehouse, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type MovementType = "IN" | "OUT" | "RESERVE" | "UNRESERVE" | "MOVE_IN" | "MOVE_OUT";

const TYPE_LABELS: Record<string, string> = {
  IN: "Приход",
  OUT: "Списание",
  RESERVE: "Резерв",
  UNRESERVE: "Снятие резерва",
  MOVE_IN: "Перемещение (приход)",
  MOVE_OUT: "Перемещение (расход)",
  IN_TRANSIT: "В пути",
};

const TYPE_COLORS: Record<string, string> = {
  IN: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OUT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  RESERVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  UNRESERVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MOVE_IN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  MOVE_OUT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  IN_TRANSIT: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
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
  const [movProductLabel, setMovProductLabel] = useState("");
  const [movProductFromRequest, setMovProductFromRequest] = useState<{ requestId: string; description: string } | null>(null);
  const [movWarehouseId, setMovWarehouseId] = useState("");
  const [movToWarehouseId, setMovToWarehouseId] = useState("");
  const [movQuantity, setMovQuantity] = useState("");
  const [movComment, setMovComment] = useState("");
  const [movRequestId, setMovRequestId] = useState("");

  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [requestPopoverOpen, setRequestPopoverOpen] = useState(false);

  // Queries
  const { data: requests = [] } = useQuery({
    queryKey: ["requests-for-movement", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description")
        .eq("organization_id", currentOrgId!)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*, request_objects(name)")
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
        .select("*, warehouse_products(name, article), warehouses(name, object_id, request_objects(name)), requests(request_number, description)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Compute stock levels from movements
  const stockLevels = useMemo(() => {
    const map = new Map<string, { product: any; warehouse: any; objectName: string; stock: number; reserve: number; inTransit: number }>();

    for (const m of movements) {
      const key = `${m.product_id}__${m.warehouse_id}`;
      if (!map.has(key)) {
        map.set(key, {
          product: m.warehouse_products,
          warehouse: m.warehouses,
          objectName: (m.warehouses as any)?.request_objects?.name || "",
          stock: 0,
          reserve: 0,
          inTransit: 0,
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
        case "IN_TRANSIT":
          entry.inTransit += m.quantity;
          break;
      }
    }

    return Array.from(map.values()).filter(
      (e) => e.stock !== 0 || e.reserve !== 0 || e.inTransit !== 0
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

      let productId = movProductId;
      let requestId = movRequestId || null;

      // If product was selected from a request, auto-create in nomenclature
      if (movProductFromRequest) {
        // Check if product with same name already exists
        const { data: existing } = await supabase
          .from("warehouse_products")
          .select("id")
          .eq("organization_id", currentOrgId!)
          .eq("name", movProductFromRequest.description)
          .limit(1);

        if (existing && existing.length > 0) {
          productId = existing[0].id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("warehouse_products")
            .insert({
              organization_id: currentOrgId!,
              name: movProductFromRequest.description,
              article: null,
              unit: "шт",
            })
            .select("id")
            .single();
          if (createErr) throw createErr;
          productId = created.id;
        }
        // Auto-link the request
        requestId = movProductFromRequest.requestId;
        // Refresh products cache
        queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      }

      const base = {
        organization_id: currentOrgId!,
        product_id: productId,
        quantity: qty,
        comment: movComment || null,
        request_id: requestId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (movementOpType === "MOVE") {
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
    setMovProductLabel("");
    setMovProductFromRequest(null);
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
                  <TableHead>Объект</TableHead>
                  <TableHead>Склад</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                  <TableHead className="text-right">В пути</TableHead>
                  <TableHead className="text-right">Резерв</TableHead>
                  <TableHead className="text-right">Доступно</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Нет данных об остатках
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStock.map((s, i) => {
                    const available = s.stock - s.reserve;
                    // Get object name from warehouse data in movement
                    const objectName = (s as any).objectName;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.product?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.product?.article || "—"}</TableCell>
                        <TableCell className="text-sm">{objectName || "—"}</TableCell>
                        <TableCell>{s.warehouse?.name || "—"}</TableCell>
                        <TableCell className="text-right">{s.stock}</TableCell>
                        <TableCell className="text-right">
                          {s.inTransit > 0 ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {s.inTransit}
                            </Badge>
                          ) : "—"}
                        </TableCell>
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
                            {m.requests.description || "—"}
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
      <Dialog open={showMovementDialog} onOpenChange={(open) => {
        setShowMovementDialog(open);
        if (!open) { setProductSearchQuery(""); setRequestSearchQuery(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementOpType === "IN" ? "Приход" : movementOpType === "OUT" ? "Списание" : "Перемещение"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Product searchable select — two sources */}
            <div>
              <Label>Товар</Label>
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {movProductLabel || "Выберите товар"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Поиск по названию, артикулу или заявке..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {/* Section: Nomenclature */}
                    {(() => {
                      const filteredProducts = products.filter((p: any) => {
                        if (!productSearchQuery) return true;
                        const q = productSearchQuery.toLowerCase();
                        return p.name?.toLowerCase().includes(q) || p.article?.toLowerCase().includes(q);
                      });
                      const filteredRequests = requests.filter((r: any) => {
                        if (!productSearchQuery) return true;
                        const q = productSearchQuery.toLowerCase();
                        return r.description?.toLowerCase().includes(q) || r.request_number?.toLowerCase().includes(q);
                      });
                      return (
                        <>
                          {filteredProducts.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">📦 Номенклатура</div>
                              {filteredProducts.map((p: any) => (
                                <button
                                  key={`prod-${p.id}`}
                                  className={cn(
                                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left",
                                    movProductId === p.id && !movProductFromRequest && "bg-accent"
                                  )}
                                  onClick={() => {
                                    setMovProductId(p.id);
                                    setMovProductLabel(`${p.name}${p.article ? ` (${p.article})` : ""}`);
                                    setMovProductFromRequest(null);
                                    setProductPopoverOpen(false);
                                    setProductSearchQuery("");
                                  }}
                                >
                                  {movProductId === p.id && !movProductFromRequest && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                  <span className={movProductId !== p.id || movProductFromRequest ? "ml-5" : ""}>
                                    {p.name} {p.article ? <span className="text-muted-foreground">({p.article})</span> : ""}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                          {filteredRequests.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">📄 Заявки</div>
                              {filteredRequests.slice(0, 50).map((r: any) => (
                                <button
                                  key={`req-${r.id}`}
                                  className={cn(
                                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left",
                                    movProductFromRequest?.requestId === r.id && "bg-accent"
                                  )}
                                  onClick={() => {
                                    setMovProductId("");
                                    setMovProductLabel(`${r.description?.slice(0, 50) || "Заявка"} (#${r.request_number})`);
                                    setMovProductFromRequest({ requestId: r.id, description: r.description || `Заявка #${r.request_number}` });
                                    setMovRequestId(r.id);
                                    setProductPopoverOpen(false);
                                    setProductSearchQuery("");
                                  }}
                                >
                                  {movProductFromRequest?.requestId === r.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                  <span className={movProductFromRequest?.requestId !== r.id ? "ml-5" : ""}>
                                    #{r.request_number} — {r.description?.slice(0, 50) || "Без описания"}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                          {filteredProducts.length === 0 && filteredRequests.length === 0 && (
                            <div className="px-3 py-4 text-sm text-center text-muted-foreground">Ничего не найдено</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
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

            {/* Request searchable select */}
            <div>
              <Label>Связанная заявка</Label>
              <Popover open={requestPopoverOpen} onOpenChange={setRequestPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {movRequestId
                      ? (() => {
                          const r = requests.find((r: any) => r.id === movRequestId);
                          return r ? `#${r.request_number} — ${r.description?.slice(0, 40) || ""}` : "Выберите заявку";
                        })()
                      : "Не выбрана"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Поиск по номеру или описанию..."
                      value={requestSearchQuery}
                      onChange={(e) => setRequestSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left text-muted-foreground"
                      onClick={() => { setMovRequestId(""); setRequestPopoverOpen(false); setRequestSearchQuery(""); }}
                    >
                      Без заявки
                    </button>
                    {requests
                      .filter((r: any) => {
                        if (!requestSearchQuery) return true;
                        const q = requestSearchQuery.toLowerCase();
                        return r.request_number?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
                      })
                      .map((r: any) => (
                        <button
                          key={r.id}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left",
                            movRequestId === r.id && "bg-accent"
                          )}
                          onClick={() => {
                            setMovRequestId(r.id);
                            setRequestPopoverOpen(false);
                            setRequestSearchQuery("");
                          }}
                        >
                          {movRequestId === r.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          <span className={movRequestId !== r.id ? "ml-5" : ""}>
                            #{r.request_number} — {r.description?.slice(0, 50) || "Без описания"}
                          </span>
                        </button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Комментарий</Label>
              <Textarea value={movComment} onChange={(e) => setMovComment(e.target.value)} placeholder="Необязательно" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMovement.mutate()}
              disabled={
                (!movProductId && !movProductFromRequest) ||
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
