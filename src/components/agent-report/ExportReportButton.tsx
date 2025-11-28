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

      // Commission row
      let commission = 0;
      if (total >= 10000000) {
        commission = 5000000 * 0.02 + 5000000 * 0.01 + (total - 10000000) * 0.005;
      } else if (total >= 5000000) {
        commission = 5000000 * 0.02 + (total - 5000000) * 0.01;
      } else {
        commission = total * 0.02;
      }
      excelData.push(["", "", "", "Сумма вознаграждения:", commission]);

      excelData.push([]);
      const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
      ];
      excelData.push([`Сумма вознаграждения согласно п. 4.2. агентского договора № ${headerData.contract_number} от ${headerData.contract_date} г. за ${monthNames[month - 1]} ${year}г.`]);
      excelData.push(["Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора."]);
      excelData.push([]);
      excelData.push(["Отчет сдал: _____________________", "", "", "Отчет принял: _____________________"]);
      excelData.push(["ИП Никулин Егор Викторович", "", "", headerData.recipient_position]);
      excelData.push(["", "", "", headerData.recipient_name]);

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Center align header cells
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let R = 0; R <= 9; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          worksheet[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет");

      // Generate file name
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
