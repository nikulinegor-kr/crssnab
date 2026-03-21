import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Trash2, FileSpreadsheet, Check, AlertCircle, Search } from "lucide-react";
import { findBestParametricMatch, parseMaterialParams, isExactStructuralMatch } from "@/lib/materialParametricMatch";
import { matchesMaterialSearch } from "@/lib/materialSearch";
import { HighlightText } from "@/components/HighlightText";
import * as XLSX from "xlsx";

interface MaterialItem {
  id: string;
  statement_id: string;
  name: string;
  type_mark: string | null;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  total_price: number | null;
  supplier: string | null;
  item_type: string;
  price_source: string;
}

interface KpSupplier {
  id: string;
  organization_id: string;
  folder_id: string;
  supplier_name: string;
  file_name: string;
  file_url: string | null;
  file_type: string;
  status: string;
  created_at: string;
}

interface KpSupplierPrice {
  id: string;
  kp_supplier_id: string;
  material_item_id: string;
  price: number | null;
  total_price: number | null;
  match_type: string | null;
}

interface KpMatch {
  kpItemName: string;
  kpPrice: number | null;
  matchedItemId: string | null;
  matchType: string;
  similarity: number;
}

interface Props {
  orgId: string;
  folderId: string;
  allItems: MaterialItem[];
}

const MAX_KP = 7;

export function KpComparisonPanel({ orgId, folderId, allItems }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [matchReviewOpen, setMatchReviewOpen] = useState(false);
  const [currentMatches, setCurrentMatches] = useState<KpMatch[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState<string | null>(null);
  const [matchSearch, setMatchSearch] = useState("");
  const [applyingMatches, setApplyingMatches] = useState(false);

  // Query KP suppliers for this folder
  const { data: kpSuppliers = [] } = useQuery({
    queryKey: ["kp-suppliers", folderId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("kp_suppliers" as any).select("*")
        .eq("folder_id", folderId)
        .eq("organization_id", orgId)
        .order("created_at") as any);
      return (data || []) as KpSupplier[];
    },
    enabled: !!orgId && !!folderId,
  });

  // Query all supplier prices for this folder's suppliers
  const supplierIds = useMemo(() => kpSuppliers.map(s => s.id), [kpSuppliers]);

  const { data: supplierPrices = [] } = useQuery({
    queryKey: ["kp-supplier-prices", supplierIds.join(",")],
    queryFn: async () => {
      if (supplierIds.length === 0) return [];
      const { data } = await (supabase
        .from("kp_supplier_prices" as any).select("*")
        .in("kp_supplier_id", supplierIds) as any);
      return (data || []) as KpSupplierPrice[];
    },
    enabled: supplierIds.length > 0,
  });

  // Build price lookup: materialItemId -> { supplierId -> price }
  const priceMap = useMemo(() => {
    const map = new Map<string, Map<string, KpSupplierPrice>>();
    for (const sp of supplierPrices) {
      if (!map.has(sp.material_item_id)) map.set(sp.material_item_id, new Map());
      map.get(sp.material_item_id)!.set(sp.kp_supplier_id, sp);
    }
    return map;
  }, [supplierPrices]);

  const handleUploadKp = async (file: File) => {
    if (!supplierName.trim()) {
      toast({ title: "Укажите имя поставщика", variant: "destructive" });
      return;
    }
    if (kpSuppliers.length >= MAX_KP) {
      toast({ title: `Максимум ${MAX_KP} КП на раздел`, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isExcel = ext === "xlsx" || ext === "xls";

      // 1. Create KP supplier record
      const { data: supplier, error: insertError } = await (supabase
        .from("kp_suppliers" as any).insert({
          organization_id: orgId,
          folder_id: folderId,
          supplier_name: supplierName.trim(),
          file_name: file.name,
          file_type: isExcel ? "xlsx" : "pdf",
          status: "recognizing",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        }).select().single() as any);

      if (insertError) throw insertError;
      const supplierId = (supplier as any).id;

      // 2. Recognize KP
      let kpData: any;
      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetsText: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", RS: "\n" });
          if (csv.trim()) sheetsText.push(`=== Лист: ${sheetName} ===\n${csv}`);
        }
        const { data: result, error } = await supabase.functions.invoke("recognize-kp", {
          body: { textContent: sheetsText.join("\n\n"), fileType: "xlsx" },
        });
        if (error) throw error;
        kpData = result;
      } else {
        const path = `${orgId}/kp/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("material-statements").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
        // Save URL
        await (supabase.from("kp_suppliers" as any).update({ file_url: urlData.publicUrl }).eq("id", supplierId) as any);
        const { data: result, error } = await supabase.functions.invoke("recognize-kp", {
          body: { fileUrl: urlData.publicUrl, fileType: "pdf" },
        });
        if (error) throw error;
        kpData = result;
      }

      const kpItems: { name: string; unit: string | null; price: number | null }[] = kpData.items || [];

      // 3. Match KP items to materials
      const materialItems = allItems.filter(i => i.item_type === "material" || !i.item_type);
      const pricedPool = materialItems.map(i => ({ id: i.id, name: i.name, unit: i.unit, price: i.price }));
      const materialWithParams = materialItems.map(i => ({ ...i, params: parseMaterialParams(i.name) }));

      const matches: KpMatch[] = kpItems.map(kpItem => {
        const kpParams = parseMaterialParams(kpItem.name);

        // Exact structural match first
        if (kpParams.type && kpParams.diameter != null) {
          for (const m of materialWithParams) {
            if (isExactStructuralMatch(kpParams, m.params)) {
              return { kpItemName: kpItem.name, kpPrice: kpItem.price, matchedItemId: m.id, matchType: "exact", similarity: 1 };
            }
          }
        }

        // Parametric/fuzzy
        const result = findBestParametricMatch(kpItem.name, kpItem.unit, pricedPool);
        if (result && (result.matchType === "parametric" || result.score >= 0.6)) {
          return { kpItemName: kpItem.name, kpPrice: kpItem.price, matchedItemId: result.itemId, matchType: result.matchType, similarity: result.score };
        }

        return { kpItemName: kpItem.name, kpPrice: kpItem.price, matchedItemId: null, matchType: "none", similarity: 0 };
      });

      setCurrentMatches(matches);
      setCurrentSupplierId(supplierId);
      setMatchReviewOpen(true);

      // Update status
      await (supabase.from("kp_suppliers" as any).update({ status: "recognized" }).eq("id", supplierId) as any);
      queryClient.invalidateQueries({ queryKey: ["kp-suppliers"] });

    } catch (e: any) {
      toast({ title: "Ошибка распознавания КП", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadDialogOpen(false);
      setSupplierName("");
    }
  };

  const handleApplyMatches = async () => {
    if (!currentSupplierId) return;
    setApplyingMatches(true);
    try {
      const toInsert = currentMatches
        .filter(m => m.matchedItemId && m.kpPrice != null)
        .map(m => {
          const item = allItems.find(i => i.id === m.matchedItemId);
          const totalPrice = item?.quantity != null && m.kpPrice != null ? item.quantity * m.kpPrice : null;
          return {
            kp_supplier_id: currentSupplierId,
            material_item_id: m.matchedItemId!,
            price: m.kpPrice,
            total_price: totalPrice,
            match_type: m.matchType,
          };
        });

      if (toInsert.length > 0) {
        // Upsert prices
        for (const item of toInsert) {
          await (supabase.from("kp_supplier_prices" as any).upsert(item, { onConflict: "kp_supplier_id,material_item_id" }) as any);
        }
      }

      const matched = toInsert.length;
      const notFound = currentMatches.filter(m => !m.matchedItemId).length;

      queryClient.invalidateQueries({ queryKey: ["kp-supplier-prices"] });
      toast({ title: `КП применено`, description: `Сопоставлено: ${matched}, не найдено: ${notFound}` });
      setMatchReviewOpen(false);
      setCurrentMatches([]);
      setCurrentSupplierId(null);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setApplyingMatches(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    await (supabase.from("kp_supplier_prices" as any).delete().eq("kp_supplier_id", id) as any);
    await (supabase.from("kp_suppliers" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["kp-suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["kp-supplier-prices"] });
    toast({ title: "КП удалено" });
  };

  const handleMatchChange = (index: number, itemId: string | null) => {
    setCurrentMatches(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], matchedItemId: itemId, matchType: itemId ? "manual" : "none" };
      return updated;
    });
  };

  const formatPrice = (val: number | null) => {
    if (val == null) return "—";
    return val.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Find minimum price per material row
  const getMinPriceSupplier = (itemId: string): string | null => {
    const prices = priceMap.get(itemId);
    if (!prices || prices.size === 0) return null;
    let minPrice = Infinity;
    let minSupplierId: string | null = null;
    prices.forEach((sp, suppId) => {
      if (sp.price != null && sp.price < minPrice) {
        minPrice = sp.price;
        minSupplierId = suppId;
      }
    });
    return minSupplierId;
  };

  if (kpSuppliers.length === 0 && allItems.length === 0) {
    // Still show upload button even with no items
    return (
      <>
        <Card>
          <CardHeader className="py-3 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Коммерческие предложения (0/{MAX_KP})
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUploadDialogOpen(true)}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Загрузить КП
            </Button>
          </CardHeader>
        </Card>

        {/* Upload KP Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={open => { if (!open && !uploading) { setUploadDialogOpen(false); setSupplierName(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Загрузить коммерческое предложение</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Название поставщика *</label>
                <Input
                  placeholder='Например: ООО "Альянс"'
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">Файл КП (Excel или PDF)</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors mt-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Нажмите для выбора файла</span>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                    disabled={!supplierName.trim() || uploading}
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        handleUploadKp(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Загружено: 0 из {MAX_KP}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const materialItems = allItems.filter(i => i.item_type === "material" || !i.item_type);

  return (
    <>
      {/* KP Suppliers List */}
      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Коммерческие предложения ({kpSuppliers.length}/{MAX_KP})
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (kpSuppliers.length >= MAX_KP) {
                toast({ title: `Максимум ${MAX_KP} КП на раздел`, variant: "destructive" });
                return;
              }
              setUploadDialogOpen(true);
            }}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Загрузить КП
          </Button>
        </CardHeader>
        {kpSuppliers.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {kpSuppliers.map(kp => (
                <div key={kp.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card text-sm">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{kp.supplier_name}</span>
                  <span className="text-xs text-muted-foreground">({kp.file_name})</span>
                  {kp.status === "recognized" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  {kp.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                  {kp.status === "recognizing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteSupplier(kp.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Comparison Table - only show when there are suppliers with prices */}
      {kpSuppliers.length > 0 && supplierPrices.length > 0 && materialItems.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Сравнение цен поставщиков</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="w-20">Ед.</TableHead>
                    <TableHead className="w-20">Кол-во</TableHead>
                    {kpSuppliers.map(kp => (
                      <TableHead key={kp.id} className="w-28 text-center" colSpan={2}>
                        <div className="text-xs leading-tight">{kp.supplier_name}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead />
                    <TableHead />
                    <TableHead />
                    <TableHead />
                    {kpSuppliers.map(kp => (
                      <><TableHead key={`${kp.id}-p`} className="w-24 text-xs text-center">Цена</TableHead>
                      <TableHead key={`${kp.id}-t`} className="w-28 text-xs text-center">Стоимость</TableHead></>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialItems.map((item, idx) => {
                    const minSupplierId = getMinPriceSupplier(item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell className="text-sm">{item.unit || "—"}</TableCell>
                        <TableCell className="text-sm">{item.quantity ?? "—"}</TableCell>
                        {kpSuppliers.map(kp => {
                          const sp = priceMap.get(item.id)?.get(kp.id);
                          const isMin = minSupplierId === kp.id && sp?.price != null;
                          return (
                            <>
                              <TableCell key={`${kp.id}-${item.id}-p`} className={`text-sm text-center ${isMin ? "text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
                                {sp?.price != null ? formatPrice(sp.price) : "—"}
                              </TableCell>
                              <TableCell key={`${kp.id}-${item.id}-t`} className={`text-sm text-center ${isMin ? "text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
                                {sp?.total_price != null ? formatPrice(sp.total_price) : "—"}
                              </TableCell>
                            </>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell />
                    <TableCell>Итого</TableCell>
                    <TableCell />
                    <TableCell />
                    {kpSuppliers.map(kp => {
                      const total = materialItems.reduce((sum, item) => {
                        const sp = priceMap.get(item.id)?.get(kp.id);
                        return sum + (sp?.total_price || 0);
                      }, 0);
                      return (
                        <>
                          <TableCell key={`${kp.id}-total-p`} className="text-center">—</TableCell>
                          <TableCell key={`${kp.id}-total-t`} className="text-center">{total > 0 ? formatPrice(total) : "—"}</TableCell>
                        </>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Upload KP Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={open => { if (!open && !uploading) { setUploadDialogOpen(false); setSupplierName(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Загрузить коммерческое предложение</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название поставщика *</label>
              <Input
                placeholder='Например: ООО "Альянс"'
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Файл КП (Excel или PDF)</label>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors mt-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Нажмите для выбора файла</span>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  className="hidden"
                  disabled={!supplierName.trim() || uploading}
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      handleUploadKp(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Загружено: {kpSuppliers.length} из {MAX_KP}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match Review Dialog */}
      <Dialog open={matchReviewOpen} onOpenChange={open => { if (!open && !applyingMatches) { setMatchReviewOpen(false); setCurrentMatches([]); } }}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Сопоставление КП с материалами
              {currentSupplierId && (() => {
                const s = kpSuppliers.find(k => k.id === currentSupplierId);
                return s ? <span className="text-sm font-normal text-muted-foreground ml-2">— {s.supplier_name}</span> : null;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="gap-1">Всего: <strong>{currentMatches.length}</strong></Badge>
            <Badge className="gap-1 bg-emerald-600">Найдено: <strong>{currentMatches.filter(m => m.matchedItemId).length}</strong></Badge>
            <Badge variant="destructive" className="gap-1">Не найдено: <strong>{currentMatches.filter(m => !m.matchedItemId).length}</strong></Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="🔎 Найти..." value={matchSearch} onChange={e => setMatchSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <ScrollArea className="flex-1 max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Из КП</TableHead>
                  <TableHead className="w-24">Цена</TableHead>
                  <TableHead>Сопоставление</TableHead>
                  <TableHead className="w-28">Тип</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMatches
                  .filter(m => !matchSearch.trim() || matchesMaterialSearch(matchSearch, m.kpItemName, null))
                  .map((match, idx) => (
                    <TableRow key={idx} className={match.matchedItemId ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "bg-destructive/5"}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-sm"><HighlightText text={match.kpItemName} searchQuery={matchSearch} /></TableCell>
                      <TableCell className="text-sm font-medium">{match.kpPrice != null ? formatPrice(match.kpPrice) : "—"}</TableCell>
                      <TableCell>
                        <Select value={match.matchedItemId || "__none__"} onValueChange={v => handleMatchChange(idx, v === "__none__" ? null : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Не найдено" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Не сопоставлено —</SelectItem>
                            {materialItems.map(item => (
                              <SelectItem key={item.id} value={item.id}>{item.name.substring(0, 80)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {match.matchedItemId ? (
                          <Badge className="bg-emerald-600 text-xs">
                            {match.matchType === "exact" ? "точное" : match.matchType === "parametric" ? "парам." : match.matchType === "manual" ? "ручное" : "нечёткое"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">не найден</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMatchReviewOpen(false); setCurrentMatches([]); }}>Отмена</Button>
            <Button onClick={handleApplyMatches} disabled={applyingMatches || currentMatches.filter(m => m.matchedItemId).length === 0}>
              {applyingMatches ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Применить ({currentMatches.filter(m => m.matchedItemId && m.kpPrice != null).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
