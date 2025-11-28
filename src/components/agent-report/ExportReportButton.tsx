import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ExportReportButtonProps {
  headerData: any;
  rows: any[];
  month: number;
  year: number;
}

export const ExportReportButton = ({ headerData, rows, month, year }: ExportReportButtonProps) => {
  const { toast } = useToast();

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Prepare data for Excel
      const excelData: any[] = [];
      
      // Header
      excelData.push(["ПРИЛОЖЕНИЕ №1"]);
      excelData.push([`К агентскому договору № ${headerData.contract_number} от ${headerData.contract_date}`]);
      excelData.push([]);
      excelData.push([`Кому: ${headerData.company_name}`]);
      excelData.push([headerData.company_address]);
      excelData.push([headerData.company_phone]);
      excelData.push([]);
      excelData.push(["Отчет агента - УУ"]);
      excelData.push([`по агентскому договору №${headerData.contract_number}`]);
      excelData.push([`За период с ${headerData.period_start} г. по ${headerData.period_end} г. произведен закуп ТМЦ:`]);
      excelData.push([]);

      // Table headers
      excelData.push(["№", "ТМЦ", "Контрагент", "№ Счета", "Сумма закупа"]);

      // Table rows
      rows.forEach(row => {
        excelData.push([
          row.row_number,
          row.tmc,
          row.contractor,
          row.invoice_number,
          row.amount
        ]);
      });

      // Total row
      const total = rows.reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount)) || 0;
        return sum + amount;
      }, 0);
      excelData.push(["", "", "", "ИТОГО:", total]);

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет");

      // Generate file name
      const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
      ];
      const fileName = `Отчет_агента_${monthNames[month - 1]}_${year}.xlsx`;

      // Download file
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
