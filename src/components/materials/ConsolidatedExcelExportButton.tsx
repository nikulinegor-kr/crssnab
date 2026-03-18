import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ConsolidatedExcelExportButtonProps {
  objectId: string;
  objectName: string;
  organizationId: string;
}

const STATUS_LABELS: Record<string, string> = {
  none: "—",
  in_procurement: "В закупке",
  ordered: "Заказано",
  delivered: "Доставлено",
};

export function ConsolidatedExcelExportButton({ objectId, objectName, organizationId }: ConsolidatedExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const PAGE_SIZE = 1000;

      // 1. Sections
      const { data: sections } = await (supabase
        .from("material_sections" as any)
        .select("id, name, sort_order")
        .eq("object_id", objectId)
        .eq("organization_id", organizationId)
        .order("sort_order") as any);

      if (!sections?.length) {
        toast({ title: "Нет разделов для экспорта", variant: "destructive" });
        setLoading(false);
        return;
      }

      // 2. Material folders
      const sectionIds = sections.map((s: any) => s.id);
      const { data: materialFolders } = await (supabase
        .from("material_folders" as any)
        .select("id, section_id")
        .in("section_id", sectionIds)
        .eq("organization_id", organizationId)
        .eq("type", "materials") as any);

      if (!materialFolders?.length) {
        toast({ title: "Нет папок 'Работы и материалы'", variant: "destructive" });
        setLoading(false);
        return;
      }

      const folderIds = materialFolders.map((f: any) => f.id);
      const folderToSection = new Map<string, string>();
      for (const f of materialFolders) folderToSection.set(f.id, f.section_id);

      // 3. Recognized statements
      let allStatements: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statements" as any)
          .select("id, folder_id, display_name, file_name")
          .in("folder_id", folderIds)
          .eq("organization_id", organizationId)
          .eq("is_recognized", true)
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = data || [];
        allStatements = allStatements.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (!allStatements.length) {
        toast({ title: "Нет распознанных файлов для экспорта", variant: "destructive" });
        setLoading(false);
        return;
      }

      const stmtToSection = new Map<string, string>();
      const stmtToName = new Map<string, string>();
      for (const st of allStatements) {
        const sectionId = folderToSection.get(st.folder_id);
        if (sectionId) stmtToSection.set(st.id, sectionId);
        stmtToName.set(st.id, st.display_name || st.file_name || "—");
      }

      // 4. All items
      const stmtIds = allStatements.map((s: any) => s.id);
      let allItems: any[] = [];
      from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statement_items" as any)
          .select("*")
          .in("statement_id", stmtIds)
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = data || [];
        allItems = allItems.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (!allItems.length) {
        toast({ title: "Нет позиций для экспорта", variant: "destructive" });
        setLoading(false);
        return;
      }

      // 5. Group items by section
      const sectionMap = new Map<string, string>();
      for (const s of sections) sectionMap.set(s.id, s.name);

      const sectionItems = new Map<string, any[]>();
      for (const item of allItems) {
        const sectionId = stmtToSection.get(item.statement_id);
        if (!sectionId) continue;
        if (!sectionItems.has(sectionId)) sectionItems.set(sectionId, []);
        sectionItems.get(sectionId)!.push(item);
      }

      // 6. Build workbook
      const wb = XLSX.utils.book_new();
      const sectionSummary: { name: string; count: number; total: number }[] = [];

      for (const sec of sections) {
        const items = sectionItems.get(sec.id) || [];
        if (items.length === 0) continue;

        let rows: any[];

        if (mergeEnabled) {
          // Merge by name + unit
          const merged = new Map<string, { name: string; type_mark: string; unit: string; quantity: number; price: number | null; total_price: number | null; procurement_status: string }>();
          for (const item of items) {
            const key = `${(item.name || "").trim().toLowerCase()}|${(item.unit || "").trim().toLowerCase()}`;
            if (merged.has(key)) {
              const ex = merged.get(key)!;
              ex.quantity += item.quantity || 0;
              if (item.price != null && ex.price == null) ex.price = item.price;
              ex.total_price = ex.quantity * (ex.price || 0) || null;
              if (item.procurement_status !== "none" && ex.procurement_status === "none") {
                ex.procurement_status = item.procurement_status;
              }
            } else {
              merged.set(key, {
                name: item.name || "",
                type_mark: item.type_mark || "",
                unit: item.unit || "",
                quantity: item.quantity || 0,
                price: item.price ?? null,
                total_price: item.total_price ?? null,
                procurement_status: item.procurement_status || "none",
              });
            }
          }
          const mergedArr = [...merged.values()];
          rows = mergedArr.map((m, i) => ({
            "№": i + 1,
            "Наименование": m.name,
            "Тип / марка": m.type_mark,
            "Ед. изм.": m.unit,
            "Количество": m.quantity || "",
            "Цена": m.price ?? "",
            "Стоимость": m.total_price ?? "",
            "Статус закупки": STATUS_LABELS[m.procurement_status] || "—",
          }));
        } else {
          // Flat: each item as separate row
          rows = items.map((item, i) => ({
            "№": i + 1,
            "Позиция": item.row_number ?? "",
            "Наименование": item.name || "",
            "Тип / марка": item.type_mark || "",
            "Ед. изм.": item.unit || "",
            "Количество": item.quantity ?? "",
            "Цена": item.price ?? "",
            "Стоимость": item.total_price ?? "",
            "Статус закупки": STATUS_LABELS[item.procurement_status] || "—",
          }));
        }

        const totalCost = items.reduce((sum: number, it: any) => sum + (it.total_price || 0), 0);
        sectionSummary.push({ name: sec.name, count: rows.length, total: totalCost });

        // Totals row
        if (mergeEnabled) {
          rows.push({
            "№": "" as any,
            "Наименование": `Итого по разделу: ${rows.length} поз.`,
            "Тип / марка": "",
            "Ед. изм.": "",
            "Количество": "" as any,
            "Цена": "" as any,
            "Стоимость": totalCost as any,
            "Статус закупки": "",
          });
        } else {
          rows.push({
            "№": "" as any,
            "Позиция": "" as any,
            "Наименование": `Итого по разделу: ${rows.length} поз.`,
            "Тип / марка": "",
            "Ед. изм.": "",
            "Количество": "" as any,
            "Цена": "" as any,
            "Стоимость": totalCost as any,
            "Статус закупки": "",
          });
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = mergeEnabled
          ? [{ wch: 5 }, { wch: 50 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }]
          : [{ wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 50 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];

        // Bold header + totals row
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let c = range.s.c; c <= range.e.c; c++) {
          const hAddr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[hAddr]) ws[hAddr].s = { font: { bold: true } };
          const tAddr = XLSX.utils.encode_cell({ r: range.e.r, c });
          if (ws[tAddr]) ws[tAddr].s = { font: { bold: true } };
        }

        const sheetName = sec.name.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      if (sectionSummary.length === 0) {
        toast({ title: "Нет данных для экспорта", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Summary sheet
      const summaryRows = sectionSummary.map(s => ({
        "Раздел": s.name,
        "Кол-во позиций": s.count,
        "Сумма": s.total,
      }));
      const grandTotal = sectionSummary.reduce((sum, s) => sum + s.total, 0);
      summaryRows.push({
        "Раздел": "ОБЩИЙ ИТОГ",
        "Кол-во позиций": sectionSummary.reduce((sum, s) => sum + s.count, 0),
        "Сумма": grandTotal,
      });
      const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
      summaryWs["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }];
      const sRange = XLSX.utils.decode_range(summaryWs["!ref"] || "A1");
      for (let c = sRange.s.c; c <= sRange.e.c; c++) {
        const hAddr = XLSX.utils.encode_cell({ r: 0, c });
        if (summaryWs[hAddr]) summaryWs[hAddr].s = { font: { bold: true } };
        const tAddr = XLSX.utils.encode_cell({ r: sRange.e.r, c });
        if (summaryWs[tAddr]) summaryWs[tAddr].s = { font: { bold: true } };
      }
      XLSX.utils.book_append_sheet(wb, summaryWs, "ИТОГО");

      XLSX.writeFile(wb, `${objectName}_materials.xlsx`);
      toast({ title: "Сводный Excel скачан", description: `${sectionSummary.length} разделов экспортировано` });
    } catch (err: any) {
      toast({ title: "Ошибка экспорта", description: err?.message || "Неизвестная ошибка", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Switch
          id="merge-toggle"
          checked={mergeEnabled}
          onCheckedChange={setMergeEnabled}
          className="scale-90"
        />
        <Label htmlFor="merge-toggle" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
          Объединять одинаковые
        </Label>
      </div>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Сводный Excel
      </Button>
    </div>
  );
}
