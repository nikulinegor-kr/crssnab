import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ConsolidatedExcelExportButtonProps {
  objectId: string;
  objectName: string;
  organizationId: string;
}

interface SectionData {
  sectionName: string;
  items: MergedItem[];
  totalCost: number;
}

interface MergedItem {
  name: string;
  type_mark: string | null;
  unit: string | null;
  quantity: number;
  price: number | null;
  total_price: number | null;
  procurement_status: string;
}

const STATUS_LABELS: Record<string, string> = {
  none: "—",
  in_procurement: "В закупке",
  ordered: "Заказано",
  delivered: "Доставлено",
};

export function ConsolidatedExcelExportButton({ objectId, objectName, organizationId }: ConsolidatedExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      // 1. Get all sections for this object
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

      // 2. Get all "materials" folders for these sections
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
      // Map folder_id -> section_id
      const folderToSection = new Map<string, string>();
      for (const f of materialFolders) {
        folderToSection.set(f.id, f.section_id);
      }

      // 3. Get all recognized statements in these folders
      const PAGE_SIZE = 1000;
      let allStatements: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statements" as any)
          .select("id, folder_id")
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

      // Map statement_id -> section_id
      const stmtToSection = new Map<string, string>();
      for (const st of allStatements) {
        const sectionId = folderToSection.get(st.folder_id);
        if (sectionId) stmtToSection.set(st.id, sectionId);
      }

      // 4. Get all material items
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

      // 5. Group items by section and merge duplicates
      const sectionMap = new Map<string, string>(); // id -> name
      for (const s of sections) sectionMap.set(s.id, s.name);

      const sectionItems = new Map<string, any[]>();
      for (const item of allItems) {
        const sectionId = stmtToSection.get(item.statement_id);
        if (!sectionId) continue;
        if (!sectionItems.has(sectionId)) sectionItems.set(sectionId, []);
        sectionItems.get(sectionId)!.push(item);
      }

      const sectionDataArr: SectionData[] = [];

      for (const sec of sections) {
        const items = sectionItems.get(sec.id) || [];
        if (items.length === 0) continue;

        // Merge by name + unit
        const merged = new Map<string, MergedItem>();
        for (const item of items) {
          const key = `${(item.name || "").trim().toLowerCase()}|${(item.unit || "").trim().toLowerCase()}`;
          if (merged.has(key)) {
            const existing = merged.get(key)!;
            existing.quantity += item.quantity || 0;
            if (item.price != null && existing.price == null) existing.price = item.price;
            existing.total_price = existing.quantity * (existing.price || 0) || null;
            // Keep "worst" procurement status
            if (item.procurement_status !== "none" && existing.procurement_status === "none") {
              existing.procurement_status = item.procurement_status;
            }
          } else {
            merged.set(key, {
              name: item.name || "",
              type_mark: item.type_mark || null,
              unit: item.unit || null,
              quantity: item.quantity || 0,
              price: item.price || null,
              total_price: item.total_price || null,
              procurement_status: item.procurement_status || "none",
            });
          }
        }

        const mergedArr = [...merged.values()];
        const totalCost = mergedArr.reduce((sum, m) => sum + (m.total_price || 0), 0);
        sectionDataArr.push({ sectionName: sec.name, items: mergedArr, totalCost });
      }

      if (sectionDataArr.length === 0) {
        toast({ title: "Нет данных для экспорта", variant: "destructive" });
        setLoading(false);
        return;
      }

      // 6. Build Excel workbook
      const wb = XLSX.utils.book_new();

      for (const section of sectionDataArr) {
        const rows = section.items.map((m, i) => ({
          "№": i + 1,
          "Наименование": m.name,
          "Тип / марка": m.type_mark || "",
          "Ед. изм.": m.unit || "",
          "Количество": m.quantity || "",
          "Цена": m.price ?? "",
          "Стоимость": m.total_price ?? "",
          "Статус закупки": STATUS_LABELS[m.procurement_status] || "—",
        }));

        // Add totals row
        rows.push({
          "№": "" as any,
          "Наименование": `Итого по разделу: ${section.items.length} поз.`,
          "Тип / марка": "",
          "Ед. изм.": "",
          "Количество": "" as any,
          "Цена": "" as any,
          "Стоимость": section.totalCost as any,
          "Статус закупки": "",
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 5 },  // №
          { wch: 50 }, // Наименование
          { wch: 25 }, // Тип / марка
          { wch: 10 }, // Ед. изм.
          { wch: 12 }, // Количество
          { wch: 12 }, // Цена
          { wch: 15 }, // Стоимость
          { wch: 18 }, // Статус закупки
        ];

        // Bold header row
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[addr]) {
            ws[addr].s = { font: { bold: true } };
          }
        }
        // Bold totals row
        const lastRow = range.e.r;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: lastRow, c });
          if (ws[addr]) {
            ws[addr].s = { font: { bold: true } };
          }
        }

        // Sheet name max 31 chars
        const sheetName = section.sectionName.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Summary "ИТОГО" sheet
      const summaryRows = sectionDataArr.map(s => ({
        "Раздел": s.sectionName,
        "Кол-во позиций": s.items.length,
        "Сумма": s.totalCost,
      }));
      const grandTotal = sectionDataArr.reduce((sum, s) => sum + s.totalCost, 0);
      summaryRows.push({
        "Раздел": "ОБЩИЙ ИТОГ",
        "Кол-во позиций": sectionDataArr.reduce((sum, s) => sum + s.items.length, 0),
        "Сумма": grandTotal,
      });

      const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
      summaryWs["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }];
      // Bold header and last row
      const sRange = XLSX.utils.decode_range(summaryWs["!ref"] || "A1");
      for (let c = sRange.s.c; c <= sRange.e.c; c++) {
        const hAddr = XLSX.utils.encode_cell({ r: 0, c });
        if (summaryWs[hAddr]) summaryWs[hAddr].s = { font: { bold: true } };
        const tAddr = XLSX.utils.encode_cell({ r: sRange.e.r, c });
        if (summaryWs[tAddr]) summaryWs[tAddr].s = { font: { bold: true } };
      }
      XLSX.utils.book_append_sheet(wb, summaryWs, "ИТОГО");

      // 7. Download
      XLSX.writeFile(wb, `${objectName}_materials.xlsx`);
      toast({ title: "Сводный Excel скачан", description: `${sectionDataArr.length} разделов экспортировано` });
    } catch (err: any) {
      toast({ title: "Ошибка экспорта", description: err?.message || "Неизвестная ошибка", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      Сводный Excel
    </Button>
  );
}
