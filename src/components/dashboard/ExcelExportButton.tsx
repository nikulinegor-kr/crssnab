import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";

interface ExcelExportButtonProps {
  requests: Request[];
  filteredRequests?: Request[];
}

let xlsxModulePromise: Promise<typeof import("xlsx")> | null = null;

async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }

  return xlsxModulePromise;
}

export function ExcelExportButton({ requests, filteredRequests }: ExcelExportButtonProps) {
  const { toast } = useToast();

  const exportToExcel = async () => {
    const dataToExport = filteredRequests || requests;
    
    if (dataToExport.length === 0) {
      toast({
        title: "Нет данных для экспорта",
        description: "Список заявок пуст",
        variant: "destructive",
      });
      return;
    }

    try {
      const XLSX = await loadXlsx();

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

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Заявки");

      const columnWidths = [
        { wch: 15 },
        { wch: 12 },
        { wch: 40 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 30 },
      ];
      worksheet["!cols"] = columnWidths;

      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `заявки_${timestamp}.xlsx`);

      toast({
        title: "Экспорт завершен",
        description: `Экспортировано ${dataToExport.length} заявок`,
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Ошибка экспорта",
        description: error?.message || "Не удалось сформировать Excel",
        variant: "destructive",
      });
    }
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
