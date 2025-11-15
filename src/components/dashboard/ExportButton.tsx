import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ExportButtonProps {
  requests: Request[];
}

export function ExportButton({ requests }: ExportButtonProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    if (requests.length === 0) {
      toast({
        title: "Нет данных",
        description: "Нет заявок для экспорта",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Номер заявки",
      "Дата",
      "Описание",
      "Статус",
      "Приоритет",
      "Заявитель",
      "Исполнитель",
      "Контрагент",
      "Дата отгрузки",
      "Дата доставки",
    ];

    const csvContent = [
      headers.join(","),
      ...requests.map(r => [
        `"${r.request_number}"`,
        format(new Date(r.request_date), "dd.MM.yyyy"),
        `"${r.description.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.priority || ''}"`,
        `"${r.applicant || ''}"`,
        `"${r.executor || ''}"`,
        `"${r.contractor || ''}"`,
        r.shipment_date ? format(new Date(r.shipment_date), "dd.MM.yyyy") : "",
        r.delivery_date ? format(new Date(r.delivery_date), "dd.MM.yyyy") : "",
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `заявки_${format(new Date(), "dd-MM-yyyy")}.csv`;
    link.click();

    toast({
      title: "Успешно",
      description: `Экспортировано ${requests.length} заявок в CSV`,
    });
  };

  const exportToJSON = () => {
    if (requests.length === 0) {
      toast({
        title: "Нет данных",
        description: "Нет заявок для экспорта",
        variant: "destructive",
      });
      return;
    }

    const jsonContent = JSON.stringify(requests, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `заявки_${format(new Date(), "dd-MM-yyyy")}.json`;
    link.click();

    toast({
      title: "Успешно",
      description: `Экспортировано ${requests.length} заявок в JSON`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Экспорт
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Формат экспорта</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Экспорт в CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Экспорт в JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
