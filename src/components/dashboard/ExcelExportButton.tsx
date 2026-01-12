import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ExcelExportButtonProps {
  requests: Request[];
  filteredRequests?: Request[];
}

export function ExcelExportButton({ requests, filteredRequests }: ExcelExportButtonProps) {
  const { toast } = useToast();

  const exportToExcel = () => {
    const dataToExport = filteredRequests || requests;
    
    if (dataToExport.length === 0) {
      toast({
        title: "Нет данных для экспорта",
        description: "Список заявок пуст",
        variant: "destructive",
      });
      return;
    }

    // Подготовка данных для Excel
    const excelData = dataToExport.map(request => ({
      "Номер заявки": request.request_number,
      "Дата заявки": request.request_date,
      "Описание": request.description,
      "Статус": request.status,
      "Приоритет": request.priority,
      "Заявитель": request.applicant || "",
      "Исполнитель": request.executor || "",
      "Срок поставки": request.availability_delivery_time || "",
      "Контрагент": request.contractor || "",
      "Номер счета": request.invoice_number || "",
      "Сумма": request.amount || 0,
      "% оплаты": request.payment_percentage || 0,
      "Дата отгрузки": request.shipment_date || "",
      "Дата доставки": request.delivery_date || "",
      "ТК": request.transport_company || "",
      "Номер ТТН": request.waybill_number || "",
      "Комментарии": request.comments || ""
    }));

    // Создание книги Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Заявки");

    // Настройка ширины колонок
    const columnWidths = [
      { wch: 15 }, // Номер заявки
      { wch: 12 }, // Дата заявки
      { wch: 40 }, // Описание
      { wch: 15 }, // Статус
      { wch: 12 }, // Приоритет
      { wch: 20 }, // Заявитель
      { wch: 20 }, // Исполнитель
      { wch: 15 }, // Срок поставки
      { wch: 25 }, // Контрагент
      { wch: 15 }, // Номер счета
      { wch: 12 }, // Сумма
      { wch: 10 }, // % оплаты
      { wch: 12 }, // Дата отгрузки
      { wch: 12 }, // Дата доставки
      { wch: 20 }, // ТК
      { wch: 15 }, // Номер ТТН
      { wch: 30 }, // Комментарии
    ];
    worksheet["!cols"] = columnWidths;

    // Скачивание файла
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `заявки_${timestamp}.xlsx`);

    toast({
      title: "Экспорт завершен",
      description: `Экспортировано ${dataToExport.length} заявок`,
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToExcel}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Экспорт Excel
    </Button>
  );
}
