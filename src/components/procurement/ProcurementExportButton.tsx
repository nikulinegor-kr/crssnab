import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { ProcurementItem } from "@/hooks/useProcurements";

interface ProcurementExportButtonProps {
  items: ProcurementItem[];
  procurementName: string;
  totalAmount: number;
}

export const ProcurementExportButton = ({ items, procurementName, totalAmount }: ProcurementExportButtonProps) => {
  const handleExport = () => {
    const rows = items.map((item, index) => ({
      "№": index + 1,
      "Наименование": item.name,
      "Кол-во": item.qty,
      "Сумма": item.total,
    }));

    rows.push({
      "№": "" as any,
      "Наименование": "",
      "Кол-во": "ИТОГО:" as any,
      "Сумма": totalAmount,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Свод");
    XLSX.writeFile(wb, `${procurementName}.xlsx`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Excel</span>
    </Button>
  );
};
