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
      
      // Header rows (centered, spanning all columns)
      excelData.push(["ПРИЛОЖЕНИЕ №1"]);
      excelData.push([`К агентскому договору № ${headerData.contract_number} от ${formattedContractDate}`]);
      excelData.push([""]);
      
      // Address block (right aligned, spanning all columns)
      excelData.push([`Кому: ${headerData.company_name}`]);
      excelData.push([headerData.company_address]);
      excelData.push([headerData.company_phone]);
      excelData.push([""]);
      
      // Report title (centered, spanning all columns)
      excelData.push(["Отчет агента"]);
      excelData.push([`по агентскому договору №${headerData.contract_number} от ${formatDate(headerData.contract_date)}г.`]);
      excelData.push([`За период с ${formatDate(headerData.period_start)} г. по ${formatDate(headerData.period_end)} г. произведен закуп ТМЦ:`]);
      excelData.push([""]);

      // Border style definition
      const borderStyle = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      };

      // Table headers (centered)
      excelData.push([
        { v: "№", s: { alignment: { horizontal: 'center' }, font: { bold: true }, border: borderStyle } },
        { v: "ТМЦ", s: { alignment: { horizontal: 'center' }, font: { bold: true }, border: borderStyle } },
        { v: "Контрагент", s: { alignment: { horizontal: 'center' }, font: { bold: true }, border: borderStyle } },
        { v: "№ Счета", s: { alignment: { horizontal: 'center' }, font: { bold: true }, border: borderStyle } },
        { v: "Сумма закупа", s: { alignment: { horizontal: 'center' }, font: { bold: true }, border: borderStyle } }
      ]);

      // Table rows
      rows.forEach(row => {
        excelData.push([
          { v: row.row_number, s: { alignment: { horizontal: 'center' }, border: borderStyle } },
          { v: row.tmc, s: { alignment: { horizontal: 'left' }, border: borderStyle } },
          { v: row.contractor, s: { alignment: { horizontal: 'left' }, border: borderStyle } },
          { v: row.invoice_number, s: { alignment: { horizontal: 'center' }, border: borderStyle } },
          { v: row.amount, s: { alignment: { horizontal: 'right' }, numFmt: '0.00', border: borderStyle } }
        ]);
      });

      // Total row
      const total = rows.reduce((sum, row) => {
        const amount = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount)) || 0;
        return sum + amount;
      }, 0);
      
      excelData.push([
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } }
      ]);
      
      excelData.push([
        { v: "ИТОГО", s: { alignment: { horizontal: 'left' }, font: { bold: true }, border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: total, s: { alignment: { horizontal: 'right' }, font: { bold: true }, numFmt: '#,##0.00', border: borderStyle } }
      ]);

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
      
      excelData.push([
        { v: `Сумма вознаграждения согласно п. 4.2. агентского договора № ${headerData.contract_number} от ${formatDate(headerData.contract_date)} г. за ${displayMonthNames[month - 1]} ${year} г.:`, s: { alignment: { horizontal: 'left' }, font: { bold: true }, border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: "", s: { border: borderStyle } },
        { v: commission, s: { alignment: { horizontal: 'right' }, font: { bold: true }, numFmt: '#,##0.00', border: borderStyle } }
      ]);

      excelData.push([""]);
      excelData.push([{ v: "Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора.", s: { alignment: { horizontal: 'left' } } }]);
      excelData.push([""]);
      excelData.push([""]);
      
      // Signature block
      excelData.push([
        "Отчет сдал: _____________________",
        "", "",
        "Отчет принял: _____________________"
      ]);
      excelData.push([
        "ИП Никулин Егор Викторович",
        "", "",
        headerData.recipient_position
      ]);
      excelData.push([
        "", "", "",
        headerData.recipient_name
      ]);

      // Create worksheet from array of arrays
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Apply cell styles
      const headerRowIndex = 11;
      
      // Style header rows (centered)
      ['A1', 'A2'].forEach(cell => {
        if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' };
        worksheet[cell].s = { alignment: { horizontal: 'center' } };
      });
      
      // Style address block (right aligned)
      ['A4', 'A5', 'A6'].forEach(cell => {
        if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' };
        worksheet[cell].s = { alignment: { horizontal: 'right' } };
      });
      
      // Style report title (centered)
      ['A8', 'A9', 'A10'].forEach(cell => {
        if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' };
        worksheet[cell].s = { alignment: { horizontal: 'center' } };
      });
      if (worksheet['A8']) worksheet['A8'].s = { alignment: { horizontal: 'center' }, font: { bold: true } };

      // Merge cells for header rows
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },  // ПРИЛОЖЕНИЕ №1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },  // К агентскому договору
        { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },  // Кому
        { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },  // Address
        { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } },  // Phone
        { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } },  // Отчет агента
        { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },  // по договору
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },  // За период
      ];
      
      // Calculate row indices for merging
      const totalRowIndex = 11 + rows.length; // After header (11) + rows
      const commissionRowIndex = totalRowIndex + 2; // After empty row and ИТОГО
      
      // Merge ИТОГО text (A-C)
      merges.push({ s: { r: totalRowIndex + 1, c: 0 }, e: { r: totalRowIndex + 1, c: 2 } });
      
      // Merge commission text (A-C)
      merges.push({ s: { r: commissionRowIndex, c: 0 }, e: { r: commissionRowIndex, c: 2 } });
      
      // Merge bottom text
      const bottomTextRow = commissionRowIndex + 2;
      merges.push({ s: { r: bottomTextRow, c: 0 }, e: { r: bottomTextRow, c: 4 } });
      
      // Merge signature blocks
      const signatureRow = bottomTextRow + 3;
      merges.push({ s: { r: signatureRow, c: 0 }, e: { r: signatureRow, c: 1 } }); // Отчет сдал (A-B)
      merges.push({ s: { r: signatureRow, c: 3 }, e: { r: signatureRow, c: 4 } }); // Отчет принял (D-E)
      merges.push({ s: { r: signatureRow + 1, c: 0 }, e: { r: signatureRow + 1, c: 1 } }); // ИП Никулин (A-B)
      merges.push({ s: { r: signatureRow + 1, c: 3 }, e: { r: signatureRow + 1, c: 4 } }); // Position (D-E)
      merges.push({ s: { r: signatureRow + 2, c: 3 }, e: { r: signatureRow + 2, c: 4 } }); // Name (D-E)
      
      worksheet['!merges'] = merges;

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // №
        { wch: 40 },  // ТМЦ
        { wch: 30 },  // Контрагент
        { wch: 20 },  // № Счета
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
