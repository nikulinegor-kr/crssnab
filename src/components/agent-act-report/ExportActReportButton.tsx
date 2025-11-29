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
}

export const ExportActReportButton = ({
  calculationRows,
  additionalRows,
  month,
  year,
}: ExportActReportButtonProps) => {
  const { toast } = useToast();

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      const monthNames = [
        "ЯНВАРЬ",
        "ФЕВРАЛЬ",
        "МАРТ",
        "АПРЕЛЬ",
        "МАЙ",
        "ИЮНЬ",
        "ИЮЛЬ",
        "АВГУСТ",
        "СЕНТЯБРЬ",
        "ОКТЯБРЬ",
        "НОЯБРЬ",
        "ДЕКАБРЬ",
      ];

      const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      };

      const excelData: any[] = [];

      // Title
      excelData.push([
        {
          v: `ОТЧЕТ АГЕНТА ПО АКТУ ЗА ${monthNames[month - 1]} ${year}г.`,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true, sz: 14 },
          },
        },
      ]);
      excelData.push([""]);

      // Subtitle
      excelData.push([
        {
          v: `Расчет суммы вознаграждения за ${monthNames[month - 1]} ${year}г.`,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
          },
        },
      ]);

      // Calculation table headers
      excelData.push([
        {
          v: "Заработная плата 30 000 +% вознаграждение агента",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "Сумма по чекам",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "ЗП+Чеки",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "Налог 7%",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "Сумма Акта",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
      ]);

      // Calculation table data
      calculationRows.forEach((row) => {
        excelData.push([
          {
            v: row.salary_with_commission || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
          {
            v: row.check_amount || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
          {
            v: row.remainder_after_tax || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
          {
            v: row.tax_7_percent || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
          {
            v: row.act_amount || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
        ]);
      });

      // Calculation totals
      const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      
      const calcTotals = {
        salary_with_commission: calculationRows.reduce(
          (sum, row) => sum + (row.salary_with_commission || 0),
          0
        ),
        tax_7_percent: calculationRows.reduce((sum, row) => sum + (row.tax_7_percent || 0), 0),
        remainder_after_tax: calculationRows.reduce(
          (sum, row) => sum + (row.remainder_after_tax || 0),
          0
        ),
        check_amount: checkAmountTotal,
        act_amount: calculationRows.reduce((sum, row) => sum + (row.act_amount || 0), 0),
      };

      excelData.push([
        {
          v: calcTotals.salary_with_commission,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
        {
          v: calcTotals.check_amount,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
        {
          v: calcTotals.remainder_after_tax,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
        {
          v: calcTotals.tax_7_percent,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
        {
          v: calcTotals.act_amount,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
      ]);

      excelData.push([""]);
      excelData.push([""]);

      // Additional table headers
      excelData.push([
        {
          v: "№",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "Описание",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
        {
          v: "Сумма",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
            fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
          },
        },
      ]);

      // Additional table data
      additionalRows.forEach((row, index) => {
        excelData.push([
          {
            v: index + 1,
            s: { alignment: { horizontal: "center" }, border: borderStyle },
          },
          {
            v: row.description || "",
            s: { alignment: { horizontal: "center" }, border: borderStyle },
          },
          {
            v: row.amount || 0,
            s: {
              alignment: { horizontal: "center" },
              numFmt: "#,##0.00",
              border: borderStyle,
            },
          },
        ]);
      });

      // Additional totals
      const addTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

      excelData.push([
        {
          v: "ИТОГО:",
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            border: borderStyle,
          },
        },
        { v: "", s: { border: borderStyle } },
        {
          v: addTotal,
          s: {
            alignment: { horizontal: "center" },
            font: { bold: true },
            numFmt: "#,##0.00",
            border: borderStyle,
          },
        },
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Merge cells
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Subtitle
      ];
      worksheet["!merges"] = merges;

      // Column widths
      worksheet["!cols"] = [
        { wch: 25 }, // Зарплата
        { wch: 15 }, // Чеки
        { wch: 15 }, // ЗП+Чеки
        { wch: 12 }, // Налог
        { wch: 15 }, // Акта
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет по акту");

      const fileName = `Отчет_по_акту_${monthNames[month - 1]}_${year}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Успешно",
        description: "Файл успешно экспортирован",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось экспортировать файл",
        variant: "destructive",
      });
    }
  };

  return (
    <Button onClick={exportToExcel} variant="outline">
      <Download className="h-4 w-4 mr-2" />
      Скачать Excel
    </Button>
  );
};
