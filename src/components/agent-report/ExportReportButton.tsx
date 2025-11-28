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

      // Format dates for display
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      const monthNames = [
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"
      ];
      
      const contractDate = new Date(headerData.contract_date);
      const contractDay = contractDate.getDate();
      const contractMonth = monthNames[contractDate.getMonth()];
      const contractYear = contractDate.getFullYear();
      const formattedContractDate = `«${contractDay}» ${contractMonth} ${contractYear} г.`;

      // Prepare data for Excel
      const excelData: any[] = [];
      
      // Header
      excelData.push(["ПРИЛОЖЕНИЕ №1"]);
      excelData.push([`К агентскому договору № ${headerData.contract_number} от ${formattedContractDate}`]);
      excelData.push([]);
      excelData.push([`Кому: ${headerData.company_name}`]);
      excelData.push([headerData.company_address]);
      excelData.push([headerData.company_phone]);
      excelData.push([]);
      excelData.push(["Отчет агента - УУ"]);
      excelData.push([`по агентскому договору №${headerData.contract_number} от ${formatDate(headerData.contract_date)}г.`]);
      excelData.push([`За период с ${formatDate(headerData.period_start)} г. по ${formatDate(headerData.period_end)} г. произведен закуп ТМЦ:`]);
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
      const displayMonthNames = [
        "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
        "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"
      ];
      excelData.push([`Сумма вознаграждения согласно п. 4.2. агентского договора № ${headerData.contract_number} от ${formatDate(headerData.contract_date)}г. за ${displayMonthNames[month - 1]} ${year}г.`]);
      excelData.push(["Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора."]);
      excelData.push([]);
      excelData.push(["Отчет сдал: _____________________", "", "", "Отчет принял: _____________________"]);
      excelData.push(["ИП Никулин Егор Викторович", "", "", headerData.recipient_position]);
      excelData.push(["", "", "", headerData.recipient_name]);

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // №
        { wch: 40 },  // ТМЦ
        { wch: 30 },  // Контрагент
        { wch: 15 },  // № Счета
        { wch: 15 }   // Сумма закупа
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет");

      // Generate file name
      const fileName = `Отчет_агента_${displayMonthNames[month - 1]}_${year}г.xlsx`;

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
