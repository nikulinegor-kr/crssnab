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
      excelData.push(["Отчет агента"]);
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
      excelData.push(["ИТОГО:", "", "", "", total]);

      // Commission row
      let commission = 0;
      if (total >= 10000000) {
        commission = 5000000 * 0.02 + 5000000 * 0.01 + (total - 10000000) * 0.005;
      } else if (total >= 5000000) {
        commission = 5000000 * 0.02 + (total - 5000000) * 0.01;
      } else {
        commission = total * 0.02;
      }
      const displayMonthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
      ];
      excelData.push([`Сумма вознаграждения согласно п. 4.2. агентского договора № ${headerData.contract_number} от ${formatDate(headerData.contract_date)} г. за ${displayMonthNames[month - 1]} ${year} г.:`, "", "", "", commission]);

      excelData.push([]);
      excelData.push(["Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора."]);
      excelData.push([]);
      excelData.push([]);
      excelData.push(["Отчет сдал: _____________________", "", "", "Отчет принял: _____________________"]);
      excelData.push(["ИП Никулин Егор Викторович", "", "", headerData.recipient_position]);
      excelData.push(["", "", "", headerData.recipient_name]);

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Merge cells and set alignment for header rows
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Row 1: A-E (ПРИЛОЖЕНИЕ №1)
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Row 2: A-E (К агентскому договору)
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Row 3: A-E (empty / Кому)
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // Row 4: A-E (Address)
        { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, // Row 5: A-E (Phone)
        { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } }, // Row 6: A-E (empty)
        { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } }, // Row 7: A-E (Отчет агента)
        { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } }, // Row 8: A-E (по агентскому договору)
        { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } }, // Row 9: A-E (За период)
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } }, // Row 10: A-E (empty after периода)
      ];

      // Set alignment for merged cells
      // Row 1 & 2: center
      worksheet['A1'] = { v: excelData[0][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };
      worksheet['A2'] = { v: excelData[1][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };
      // Row 3-6: right align (Кому и адресные строки)
      worksheet['A3'] = { v: excelData[2][0], t: 's', s: { alignment: { horizontal: 'right', vertical: 'center' } } };
      worksheet['A4'] = { v: excelData[3][0], t: 's', s: { alignment: { horizontal: 'right', vertical: 'center' } } };
      worksheet['A5'] = { v: excelData[4][0], t: 's', s: { alignment: { horizontal: 'right', vertical: 'center' } } };
      worksheet['A6'] = { v: excelData[5][0], t: 's', s: { alignment: { horizontal: 'right', vertical: 'center' } } };
      // Row 7-9: center (Отчет, по договору, За период)
      worksheet['A7'] = { v: excelData[6][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };
      worksheet['A8'] = { v: excelData[7][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };
      worksheet['A9'] = { v: excelData[8][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };
      worksheet['A10'] = { v: excelData[9][0], t: 's', s: { alignment: { horizontal: 'center', vertical: 'center' } } };

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
      const fileMonthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
      ];
      const fileName = `Отчет_агента_${fileMonthNames[month - 1]}_${year}.xlsx`;

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
