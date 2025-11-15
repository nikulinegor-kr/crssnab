import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";

interface ExcelExportButtonProps {
  requests: Request[];
  filteredRequests?: Request[];
}

export function ExcelExportButton({ requests, filteredRequests }: ExcelExportButtonProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    const dataToExport = filteredRequests || requests;
    
    if (dataToExport.length === 0) {
      toast({
        title: "Нет данных для экспорта",
        description: "Список заявок пуст",
        variant: "destructive",
      });
      return;
    }

    // Заголовки CSV
    const headers = [
      "Номер заявки",
      "Дата заявки",
      "Описание",
      "Статус",
      "Приоритет",
      "Заявитель",
      "Исполнитель",
      "Срок поставки",
      "Контрагент",
      "Номер счета",
      "% оплаты",
      "Дата отгрузки",
      "Дата доставки",
      "ТК",
      "Номер ТТН",
      "Комментарии"
    ];

    // Преобразование данных в строки CSV
    const rows = dataToExport.map(request => [
      request.request_number,
      request.request_date,
      `"${request.description.replace(/"/g, '""')}"`,
      request.status,
      request.priority,
      request.applicant || "",
      request.executor || "",
      request.availability_delivery_time || "",
      request.contractor || "",
      request.invoice_number || "",
      request.payment_percentage,
      request.shipment_date || "",
      request.delivery_date || "",
      request.transport_company || "",
      request.waybill_number || "",
      request.comments ? `"${request.comments.replace(/"/g, '""')}"` : ""
    ]);

    // Формирование CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Создание и скачивание файла
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split("T")[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `заявки_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Экспорт завершен",
      description: `Экспортировано ${dataToExport.length} заявок`,
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToCSV}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Экспорт CSV
    </Button>
  );
}
