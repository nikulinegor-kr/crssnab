import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface CalculationRow {
  transfer_date: string | null;
  transferred_amount: number | null;
  tax_7_percent: number | null;
  remainder_after_tax: number | null;
  salary_with_commission: number | null;
  check_amount: number | null;
  act_amount: number | null;
}

interface AdditionalRow {
  description: string | null;
  amount: number | null;
}

interface ExportActReportButtonProps {
  calculationRows: CalculationRow[];
  additionalRows: AdditionalRow[];
  month: number;
  year: number;
  agentCommission?: number;
}

export const ExportActReportButton = ({
  calculationRows,
  additionalRows,
  month,
  year,
  agentCommission = 0,
}: ExportActReportButtonProps) => {
  const { toast } = useToast();

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      const monthNames = [
        "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
        "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ",
      ];

      const excelData: any[][] = [];

      // Title
      excelData.push([`ОТЧЕТ АГЕНТА ПО АКТУ ЗА ${monthNames[month - 1]} ${year}г.`]);
      excelData.push([""]);

      // Subtitle
      excelData.push([`Расчет суммы вознаграждения за ${monthNames[month - 1]}  ${year}г.`]);

      // Headers
      excelData.push([
        "Дата перечисления",
        "Перечислено на р/счет, касса в том числе вознаграждение",
        "Налог 7%",
        "Остаток после удержания налога 7%",
        "Заработная плата 30 000\n+% вознаграждение агента",
        "Сумма по чекам",
        "Сумма Акта",
      ]);

      const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

      // Data rows
      calculationRows.forEach((row) => {
        excelData.push([
          row.transfer_date || "",
          row.transferred_amount || "",
          row.tax_7_percent || 0,
          row.remainder_after_tax || 0,
          30000,
          checkAmountTotal,
          row.act_amount || 0,
        ]);
        // Commission sub-row
        if (agentCommission > 0) {
          excelData.push(["", "", "", "", agentCommission, "", ""]);
        }
      });

      // Totals
      const calcTotals = {
        tax_7_percent: calculationRows.reduce((sum, row) => sum + (row.tax_7_percent || 0), 0),
        remainder_after_tax: calculationRows.reduce((sum, row) => sum + (row.remainder_after_tax || 0), 0),
        salary_with_commission: calculationRows.reduce((sum, row) => {
          return sum + (row.salary_with_commission !== null && row.salary_with_commission !== 0
            ? row.salary_with_commission : 30000 + agentCommission);
        }, 0),
        check_amount: checkAmountTotal,
        act_amount: calculationRows.reduce((sum, row) => sum + (row.act_amount || 0), 0),
      };

      excelData.push([
        "ИТОГО:",
        "",
        calcTotals.tax_7_percent,
        calcTotals.remainder_after_tax,
        calcTotals.salary_with_commission,
        calcTotals.check_amount,
        calcTotals.act_amount,
      ]);

      excelData.push([""]);
      excelData.push([""]);

      // Checks table
      excelData.push(["№", "", "", "", "", "", "Сумма"]);

      additionalRows.forEach((row, index) => {
        excelData.push([index + 1, row.description || "", "", "", "", "", row.amount || 0]);
      });

      const addTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      excelData.push(["ИТОГО:", "", "", "", "", "", addTotal || "-"]);

      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Merges
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      ];
      worksheet["!merges"] = merges;

      // Column widths
      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 30 },
        { wch: 14 },
        { wch: 20 },
        { wch: 25 },
        { wch: 16 },
        { wch: 16 },
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет по акту");

      const fileName = `Отчет_по_акту_${monthNames[month - 1]}_${year}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({ title: "Успешно", description: "Файл успешно экспортирован" });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({ title: "Ошибка", description: "Не удалось экспортировать файл", variant: "destructive" });
    }
  };

  return (
    <Button onClick={exportToExcel} variant="outline">
      <Download className="h-4 w-4 mr-2" />
      Скачать Excel
    </Button>
  );
};