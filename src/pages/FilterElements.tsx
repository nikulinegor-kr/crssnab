import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useFilterElementsList, type FilterElementRow } from "@/hooks/useFilterElements";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Filter, AlertTriangle, MoreHorizontal, Pencil, Trash2, PackagePlus, PackageMinus, Archive } from "lucide-react";
import { FilterElementFormDialog } from "@/components/filter-elements/FilterElementFormDialog";
import { FilterElementDetailDialog } from "@/components/filter-elements/FilterElementDetailDialog";
import { FilterElementMovementDialog } from "@/components/filter-elements/FilterElementMovementDialog";
import { FilterElementWriteOffDialog } from "@/components/filter-elements/FilterElementWriteOffDialog";
import { FilterMoveToDeadstockDialog } from "@/components/filter-elements/FilterMoveToDeadstockDialog";
import { FilterElementsDeadstockTab } from "@/components/filter-elements/FilterElementsDeadstockTab";
import { toast } from "sonner";

const formatEq = (e: { brand: string | null; model: string | null }) =>
  [e.brand, e.model].filter(Boolean).join(" ").trim() || "—";
const fmtRub = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;


export default function FilterElementsPage() {
  const { currentOrgId } = useCurrentOrganization();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useFilterElementsList(currentOrgId);

  const [search, setSearch] = useState("");
  const [manufacturer, setManufacturer] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [lowOnly, setLowOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<FilterElementRow | null>(null);
  const [detailItem, setDetailItem] = useState<FilterElementRow | null>(null);
  const [inItem, setInItem] = useState<FilterElementRow | null>(null);
  const [writeOffItem, setWriteOffItem] = useState<FilterElementRow | null>(null);
  const [toDeadstockItem, setToDeadstockItem] = useState<FilterElementRow | null>(null);

  const { data: equipmentAll = [] } = useQuery({
    queryKey: ["equipment-list-simple", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("equipment")
        .select("id, brand, model, plate_number")
        .eq("organization_id", currentOrgId)
        .order("brand");
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });

  const manufacturers = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.manufacturer && s.add(i.manufacturer));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (manufacturer !== "all" && i.manufacturer !== manufacturer) return false;
      if (lowOnly && (i.stock ?? 0) > (i.min_stock ?? 0)) return false;
      if (equipmentFilter !== "all") {
        const has = (i.equipment ?? []).some((e) => e.id === equipmentFilter);
        if (!has) return false;
      }
      if (!search.trim()) return true;
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      const hay = [
        i.name, i.article, i.manufacturer, i.storage_location,
        ...(i.cross_numbers ?? []),
        ...((i.equipment ?? []).map((e) => `${e.brand ?? ""} ${e.model ?? ""} ${e.plate_number ?? ""}`)),
      ].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, search, manufacturer, equipmentFilter, lowOnly]);

  const lowCount = items.filter((i) => (i.stock ?? 0) <= (i.min_stock ?? 0)).length;

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("filter_elements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-elements-list"] });
      toast.success("Удалено");
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Filter className="h-6 w-6" />
              Фильтрующие элементы
            </h1>
            <p className="text-sm text-muted-foreground">Отдельный склад фильтров с совместимостью, списанием и неликвидом</p>
          </div>
          <Button onClick={() => { setEditItem(null); setFormOpen(true); }} disabled={!currentOrgId}>
            <Plus className="h-4 w-4 mr-1" />Добавить фильтр
          </Button>
        </div>

        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Каталог ({items.length})</TabsTrigger>
            <TabsTrigger value="deadstock">Неликвид фильтров</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Позиций</div>
                <div className="text-xl font-semibold font-numeric">{items.length}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Ниже мин.</div>
                <div className="text-xl font-semibold font-numeric text-destructive">{lowCount}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Производителей</div>
                <div className="text-xl font-semibold font-numeric">{manufacturers.length}</div>
              </Card>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск: название, артикул, кросс, техника..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Производитель" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все производители</SelectItem>
                  {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Совместимость с техникой" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Вся техника</SelectItem>
                  {(equipmentAll as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant={lowOnly ? "default" : "outline"} size="sm" onClick={() => setLowOnly((v) => !v)}>
                <AlertTriangle className="h-4 w-4 mr-1" />Ниже минимума
              </Button>
              <Badge variant="secondary">{filtered.length} из {items.length}</Badge>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <TooltipProvider delayDuration={150}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Производитель</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead>Кросс-номер</TableHead>
                    <TableHead>Совместимость с техникой</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Мин. остаток</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Загрузка...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="h-8 w-8 text-muted-foreground/40" />
                          <span>Ничего не найдено</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((i) => {
                      const low = (i.stock ?? 0) <= (i.min_stock ?? 0);
                      const eqs = i.equipment ?? [];
                      const crosses = i.cross_numbers ?? [];
                      const firstEq = eqs[0];
                      const extra = Math.max(0, eqs.length - 1);
                      return (
                        <TableRow key={i.id} className="hover:bg-accent/50">
                          <TableCell className="text-xs">{i.manufacturer || "—"}</TableCell>
                          <TableCell className="font-medium cursor-pointer" onClick={() => setDetailItem(i)}>{i.name}</TableCell>
                          <TableCell className="text-xs">{i.article || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {crosses.slice(0, 2).map((c) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                              {crosses.length > 2 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">+{crosses.length - 2}</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="flex flex-wrap gap-1">
                                      {crosses.slice(2).map((c) => <span key={c} className="text-xs">{c}</span>)}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {crosses.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {eqs.length === 0 ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-1 cursor-help">
                                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                                      {formatEq(firstEq)}
                                    </Badge>
                                    {extra > 0 && (
                                      <span className="text-xs text-muted-foreground">(+{extra})</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs font-medium mb-1">Совместимая техника ({eqs.length})</div>
                                  <div className="flex flex-col gap-0.5">
                                    {eqs.map((e) => (
                                      <div key={e.id} className="text-xs">
                                        {formatEq(e)}{e.plate_number ? ` • ${e.plate_number}` : ""}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-numeric">
                            <Badge variant={low ? "destructive" : "secondary"}>{i.stock ?? 0}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-1">{i.unit}</span>
                          </TableCell>
                          <TableCell className="text-right font-numeric text-muted-foreground text-xs">{i.min_stock ?? 0}</TableCell>
                          <TableCell className="text-right">
                            {i.last_price == null && i.avg_price == null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex flex-col items-end cursor-help leading-tight">
                                    <span className="font-numeric text-sm">{fmtRub(i.last_price)}</span>
                                    <span className="text-[10px] text-muted-foreground font-numeric">
                                      ср. {fmtRub(i.avg_price)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">Последняя закупочная цена</div>
                                  <div className="text-xs">Средняя за {i.purchase_count ?? 0} закупок: {fmtRub(i.avg_price)}</div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setInItem(i)}>
                                  <PackagePlus className="h-4 w-4 mr-2" />Пополнить
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setWriteOffItem(i)} disabled={(i.stock ?? 0) <= 0}>
                                  <PackageMinus className="h-4 w-4 mr-2" />Списать
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setToDeadstockItem(i)} disabled={(i.stock ?? 0) <= 0}>
                                  <Archive className="h-4 w-4 mr-2" />В неликвид
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setEditItem(i); setFormOpen(true); }}>
                                  <Pencil className="h-4 w-4 mr-2" />Редактировать
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { if (confirm(`Удалить фильтр «${i.name}»?`)) del.mutate(i.id); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />Удалить
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </TooltipProvider>
            </div>
          </TabsContent>


          <TabsContent value="deadstock">
            {currentOrgId && <FilterElementsDeadstockTab orgId={currentOrgId} />}
          </TabsContent>
        </Tabs>

        {currentOrgId && (
          <FilterElementFormDialog open={formOpen} onOpenChange={setFormOpen} orgId={currentOrgId} item={editItem} />
        )}
        {detailItem && (
          <FilterElementDetailDialog open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(null)} item={detailItem} />
        )}
        {currentOrgId && inItem && (
          <FilterElementMovementDialog
            open={!!inItem}
            onOpenChange={(v) => !v && setInItem(null)}
            orgId={currentOrgId}
            filterElementId={inItem.id}
            filterName={inItem.name}
            type="IN"
          />
        )}
        {currentOrgId && writeOffItem && (
          <FilterElementWriteOffDialog
            open={!!writeOffItem}
            onOpenChange={(v) => !v && setWriteOffItem(null)}
            orgId={currentOrgId}
            filterElementId={writeOffItem.id}
            filterName={writeOffItem.name}
            currentStock={writeOffItem.stock ?? 0}
          />
        )}
        {currentOrgId && toDeadstockItem && (
          <FilterMoveToDeadstockDialog
            open={!!toDeadstockItem}
            onOpenChange={(v) => !v && setToDeadstockItem(null)}
            orgId={currentOrgId}
            item={toDeadstockItem}
          />
        )}
      </div>
    </AppLayout>
  );
}
