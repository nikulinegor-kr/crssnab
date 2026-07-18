import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useSparePartsList, type SparePartRow } from "@/hooks/useSpareParts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, AlertTriangle, RussianRuble, Printer } from "lucide-react";
import { SparePartFormDialog } from "@/components/spare-parts/SparePartFormDialog";
import { SparePartDetailDialog } from "@/components/spare-parts/SparePartDetailDialog";
import { SparePartsDeadstockTab } from "@/components/spare-parts/SparePartsDeadstockTab";
import { SparePartsPrintDialog } from "@/components/spare-parts/SparePartsPrintDialog";

export default function SpareParts() {
  const { currentOrgId } = useCurrentOrganization();
  const { data: parts = [], isLoading } = useSparePartsList(currentOrgId);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [detailPart, setDetailPart] = useState<SparePartRow | null>(null);

  const categories = useMemo(() => {
    const s = new Set<string>();
    parts.forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [parts]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (lowOnly && (p.stock ?? 0) > (p.min_stock ?? 0)) return false;
      if (!search.trim()) return true;
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      const hay = [p.name, p.article, (p as any).manufacturer, p.category, ...(p.cross_numbers ?? [])].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [parts, search, category, lowOnly]);

  const totalValue = filtered.reduce((s, p) => s + (p.stock ?? 0) * (Number((p as any).purchase_price ?? p.price ?? 0) || 0), 0);
  const lowCount = parts.filter((p) => (p.stock ?? 0) <= (p.min_stock ?? 0)).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Склад запасных частей
            </h1>
            <p className="text-sm text-muted-foreground">Каталог, остатки, движения и неликвид</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setPrintOpen(true)} disabled={!currentOrgId || parts.length === 0}>
              <Printer className="h-4 w-4 mr-1" />Печать ведомости
            </Button>
            <Button onClick={() => setFormOpen(true)} disabled={!currentOrgId}>
              <Plus className="h-4 w-4 mr-1" />Добавить запчасть
            </Button>
          </div>
        </div>

        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Каталог ({parts.length})</TabsTrigger>
            <TabsTrigger value="deadstock">Неликвид</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Позиций</div>
                <div className="text-xl font-semibold font-numeric">{parts.length}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Ниже мин.</div>
                <div className="text-xl font-semibold font-numeric text-destructive">{lowCount}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><RussianRuble className="h-3 w-3" />Стоимость склада</div>
                <div className="text-xl font-semibold font-numeric">{totalValue.toLocaleString("ru-RU")} ₽</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Категорий</div>
                <div className="text-xl font-semibold font-numeric">{categories.length}</div>
              </Card>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск: название, артикул, кросс..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Категория" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={lowOnly ? "default" : "outline"} size="sm" onClick={() => setLowOnly((v) => !v)}>
                <AlertTriangle className="h-4 w-4 mr-1" />Ниже минимума
              </Button>
              <Badge variant="secondary">{filtered.length} из {parts.length}</Badge>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Производитель</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead className="text-right">Мин.</TableHead>
                    <TableHead className="text-right">Цена ₽</TableHead>
                    <TableHead>Хранение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Загрузка...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-8 w-8 text-muted-foreground/40" />
                          <span>Ничего не найдено</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => {
                      const low = (p.stock ?? 0) <= (p.min_stock ?? 0);
                      const storage = [p.rack, p.shelf, p.cell].filter(Boolean).join("/") || p.storage_location || "—";
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setDetailPart(p)}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs">{p.article || "—"}</TableCell>
                          <TableCell className="text-xs">{p.category || "—"}</TableCell>
                          <TableCell className="text-xs">{(p as any).manufacturer || "—"}</TableCell>
                          <TableCell className="text-right font-numeric">
                            <Badge variant={low ? "destructive" : "secondary"}>{p.stock ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-numeric text-muted-foreground text-xs">{p.min_stock ?? 0}</TableCell>
                          <TableCell className="text-right font-numeric">{p.price ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{storage}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="deadstock">
            {currentOrgId && <SparePartsDeadstockTab orgId={currentOrgId} />}
          </TabsContent>
        </Tabs>

        {currentOrgId && <SparePartFormDialog open={formOpen} onOpenChange={setFormOpen} orgId={currentOrgId} />}
        {currentOrgId && (
          <SparePartsPrintDialog open={printOpen} onOpenChange={setPrintOpen} orgId={currentOrgId} parts={filtered} />
        )}
        {currentOrgId && detailPart && (
          <SparePartDetailDialog open={!!detailPart} onOpenChange={(v) => !v && setDetailPart(null)} part={detailPart} orgId={currentOrgId} />
        )}
      </div>
    </AppLayout>
  );
}
