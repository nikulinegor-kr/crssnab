import { Button } from "@/components/ui/button";
import { Tag } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import * as XLSX from "xlsx";

interface LabelExportButtonProps {
  selectedRequests: Request[];
}

export function LabelExportButton({ selectedRequests }: LabelExportButtonProps) {
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  const exportLabels = async () => {
    if (selectedRequests.length === 0) {
      toast({
        title: "Нет выбранных заявок",
        description: "Выберите заявки для печати этикеток",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrgId) {
      toast({
        title: "Ошибка",
        description: "Не выбрана организация",
        variant: "destructive",
      });
      return;
    }

    try {
      // Получаем данные организации
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("name, contact_phone")
        .eq("id", currentOrgId)
        .single();

      if (orgError) throw orgError;

      // Создаем workbook
      const wb = XLSX.utils.book_new();
      
      // Создаем массив данных с заголовками
      const labelsData: any[][] = [
        ["Организация", "Тел", "Заявка", "Ответственный"]
      ];

      // Добавляем данные для каждой этикетки
      selectedRequests.forEach((request) => {
        labelsData.push([
          orgData.name,
          orgData.contact_phone || "",
          request.request_number,
          request.applicant || ""
        ]);
      });

      // Создаем worksheet
      const ws = XLSX.utils.aoa_to_sheet(labelsData);

      // Устанавливаем ширину колонок
      ws['!cols'] = [
        { wch: 30 }, // Организация
        { wch: 15 }, // Тел
        { wch: 20 }, // Заявка
        { wch: 25 }  // Ответственный
      ];

      // Добавляем worksheet в workbook
      XLSX.utils.book_append_sheet(wb, ws, "Этикетки");

      // Сохраняем файл
      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `этикетки_${timestamp}.xlsx`);

      toast({
        title: "Экспорт завершен",
        description: `Экспортировано ${selectedRequests.length} этикеток`,
      });
    } catch (error) {
      console.error("Error exporting labels:", error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать этикетки",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportLabels}
      disabled={selectedRequests.length === 0}
      className="gap-2"
    >
      <Tag className="h-4 w-4" />
      Печать этикеток ({selectedRequests.length})
    </Button>
  );
}
