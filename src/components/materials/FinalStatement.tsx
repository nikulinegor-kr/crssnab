import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Loader2, ChevronDown, ChevronRight, Layers } from "lucide-react";
import * as XLSX from "xlsx";

interface FinalStatementProps {
  orgId: string;
  objectId: string;
  objectName: string;
  sections: { id: string; object_id: string; name: string; sort_order: number }[];
  folders: { id: string; section_id: string | null; type: string }[];
}

interface AggItem {
  id: string;
  statement_id: string;
  name: string;
  type_mark: string | null;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  total_price: number | null;
  procurement_status: string;
  supplier: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  none: "—",
  in_procurement: "В закупке",
  ordered: "Заказано",
  delivered: "Доставлено",
};

export function FinalStatement({ orgId, objectId, objectName, sections, folders }: FinalStatementProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const objectSections = useMemo(
    () => sections.filter(s => s.object_id === objectId).sort((a, b) => a.sort_order - b.sort_order),
    [sections, objectId]
  );

  // Get all materials folder IDs for this object
  const materialsFolderIds = useMemo(() => {
    const sectionIds = new Set(objectSections.map(s => s.id));
    return folders
      .filter(f => f.section_id && sectionIds.has(f.section_id) && f.type === "materials")
      .map(f => f.id);
  }, [objectSections, folders]);

  const folderToSection = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) {
      if (f.section_id && f.type === "materials") map.set(f.id, f.section_id);
    }
    return map;
  }, [folders]);

  // Fetch all recognized statements in these folders
  const { data: statementsData = [], isLoading: stmtsLoading } = useQuery({
    queryKey: ["final-stmt-statements", orgId, objectId, materialsFolderIds],
    queryFn: async () => {
      if (materialsFolderIds.length === 0) return [];
      const PAGE_SIZE = 1000;
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statements" as any)
          .select("id, folder_id")
          .in("folder_id", materialsFolderIds)
          .eq("organization_id", orgId)
          .eq("is_recognized", true)
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = data || [];
        all = all.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: materialsFolderIds.length > 0,
  });

  const stmtToSection = useMemo(() => {
    const map = new Map<string, string>();
    for (const st of statementsData) {
      const secId = folderToSection.get(st.folder_id);
      if (secId) map.set(st.id, secId);
    }
    return map;
  }, [statementsData, folderToSection]);

  // Fetch all items
  const stmtIds = useMemo(() => statementsData.map((s: any) => s.id), [statementsData]);

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["final-stmt-items", orgId, objectId, stmtIds],
    queryFn: async () => {
      if (stmtIds.length === 0) return [];
      const PAGE_SIZE = 1000;
      let all: AggItem[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statement_items" as any)
          .select("id, statement_id, name, type_mark, unit, quantity, price, total_price, procurement_status, supplier")
          .in("statement_id", stmtIds)
          .order("row_number")
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = (data || []) as AggItem[];
        all = all.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: stmtIds.length > 0,
  });

  // Group items by section
  const itemsBySection = useMemo(() => {
    const map = new Map<string, AggItem[]>();
    for (const item of allItems) {
      const secId = stmtToSection.get(item.statement_id);
      if (!secId) continue;
      if (!map.has(secId)) map.set(secId, []);
      map.get(secId)!.push(item);
    }
    return map;
  }, [allItems, stmtToSection]);

  const grandTotal = useMemo(() => allItems.reduce((s, i) => s + (i.total_price || 0), 0), [allItems]);

  const isLoading = stmtsLoading || itemsLoading;

  const toggleSection = (secId: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(secId) ? n.delete(secId) : n.add(secId);
      return n;
    });
  };

  const formatPrice = (val: number | null) => {
    if (val == null) return "—";
    return val.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportSectionExcel = (sec: { id: string; name: string }) => {
    const items = itemsBySection.get(sec.id) || [];
    const rows = items.map((m, i) => ({
      "№": i + 1,
      "Наименование": m.name,
      "Тип / марка": m.type_mark || "",
      "Ед. изм.": m.unit || "",
      "Количество": m.quantity ?? "",
      "Цена": m.price ?? "",
      "Стоимость": m.total_price ?? "",
      "Статус закупки": STATUS_LABELS[m.procurement_status] || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sec.name.substring(0, 31));
    XLSX.writeFile(wb, `${sec.name}_materials.xlsx`);
  };

  const exportFullExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryData: { name: string; count: number; total: number }[] = [];

    for (const sec of objectSections) {
      const items = itemsBySection.get(sec.id) || [];
      if (items.length === 0) continue;

      const rows = items.map((m, i) => ({
        "№": i + 1,
        "Наименование": m.name,
        "Тип / марка": m.type_mark || "",
        "Ед. изм.": m.unit || "",
        "Количество": m.quantity ?? "",
        "Цена": m.price ?? "",
        "Стоимость": m.total_price ?? "",
        "Статус закупки": STATUS_LABELS[m.procurement_status] || "—",
      }));

      const sectionTotal = items.reduce((s, i) => s + (i.total_price || 0), 0);
      summaryData.push({ name: sec.name, count: rows.length, total: sectionTotal });

      rows.push({
        "№": "" as any,
        "Наименование": `Итого по разделу: ${rows.length} поз.`,
        "Тип / марка": "",
        "Ед. изм.": "",
        "Количество": "" as any,
        "Цена": "" as any,
        "Стоимость": sectionTotal as any,
        "Статус закупки": "",
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, sec.name.substring(0, 31));
    }

    // Summary sheet
    const summaryRows = summaryData.map(s => ({
      "Раздел": s.name,
      "Кол-во позиций": s.count,
      "Сумма": s.total,
    }));
    summaryRows.push({
      "Раздел": "ОБЩИЙ ИТОГ",
      "Кол-во позиций": summaryData.reduce((s, d) => s + d.count, 0),
      "Сумма": summaryData.reduce((s, d) => s + d.total, 0),
    });
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, "ИТОГО");

    XLSX.writeFile(wb, `${objectName}_финальная_ведомость.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{objectName}</h1>
          <p className="text-sm text-muted-foreground">
            Финальная ведомость — агрегация всех разделов
            {grandTotal > 0 && (
              <span className="ml-3 text-primary font-semibold">
                Общий итог: {formatPrice(grandTotal)} ₽
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportFullExcel} disabled={allItems.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Скачать общий Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileSpreadsheet className="h-12 w-12" />
          <p>Нет распознанных материалов</p>
          <p className="text-xs">Загрузите и распознайте файлы в разделах объекта</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Разделов</p>
              <p className="text-xl font-bold">{objectSections.filter(s => (itemsBySection.get(s.id) || []).length > 0).length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Всего позиций</p>
              <p className="text-xl font-bold">{allItems.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">С ценами</p>
              <p className="text-xl font-bold text-emerald-600">{allItems.filter(i => i.price != null).length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Общая стоимость</p>
              <p className="text-lg font-bold text-primary">{formatPrice(grandTotal)} ₽</p>
            </Card>
          </div>

          {/* Per-section tables */}
          {objectSections.map(sec => {
            const items = itemsBySection.get(sec.id) || [];
            if (items.length === 0) return null;
            const sectionTotal = items.reduce((s, i) => s + (i.total_price || 0), 0);
            const isExpanded = expandedSections.has(sec.id);
            const procuredCount = items.filter(i => i.procurement_status && i.procurement_status !== "none").length;

            return (
              <Card key={sec.id}>
                <CardHeader
                  className="py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleSection(sec.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">{sec.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{items.length} поз.</Badge>
                      {procuredCount > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          {procuredCount} в закупке
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-primary">{formatPrice(sectionTotal)} ₽</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => { e.stopPropagation(); exportSectionExcel(sec); }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> Excel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">№</TableHead>
                          <TableHead>Наименование</TableHead>
                          <TableHead>Тип / марка</TableHead>
                          <TableHead className="w-20">Ед. изм.</TableHead>
                          <TableHead className="w-24">Кол-во</TableHead>
                          <TableHead className="w-24">Цена</TableHead>
                          <TableHead className="w-28">Стоимость</TableHead>
                          <TableHead className="w-28">Закупка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={item.id} className={item.procurement_status !== "none" ? "bg-muted/40" : ""}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.type_mark || "—"}</TableCell>
                            <TableCell>{item.unit || "—"}</TableCell>
                            <TableCell>{item.quantity ?? "—"}</TableCell>
                            <TableCell>{formatPrice(item.price)}</TableCell>
                            <TableCell className="font-medium">{formatPrice(item.total_price)}</TableCell>
                            <TableCell>
                              {item.procurement_status === "in_procurement" && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">В закупке</Badge>
                              )}
                              {item.procurement_status === "ordered" && (
                                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">Заказано</Badge>
                              )}
                              {item.procurement_status === "delivered" && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">Доставлено</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell />
                          <TableCell colSpan={4} className="text-right text-sm">Итого по разделу:</TableCell>
                          <TableCell />
                          <TableCell className="text-sm">{formatPrice(sectionTotal)} ₽</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Grand total card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="py-4 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-3">
                <span>Общий итог по объекту</span>
                <Badge variant="secondary">{allItems.length} позиций</Badge>
                <Badge variant="outline">
                  {objectSections.filter(s => (itemsBySection.get(s.id) || []).length > 0).length} разделов
                </Badge>
              </CardTitle>
              <span className="text-lg font-bold text-primary">
                {formatPrice(grandTotal)} ₽
              </span>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}
