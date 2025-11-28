import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import * as XLSX from "xlsx";

interface ExportAppendixButtonProps {
  month: number;
  year: number;
}

export const ExportAppendixButton = ({ month, year }: ExportAppendixButtonProps) => {
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  const exportToExcel = async () => {
    if (!currentOrgId) return;

    try {
      // Fetch data for both sheets
      const { data: sheet1Data, error: error1 } = await supabase
        .from("appendix_data")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", month)
        .eq("year", year)
        .eq("sheet_type", "sheet1")
        .order("row_number");

      const { data: sheet2Data, error: error2 } = await supabase
        .from("appendix_data")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", month)
        .eq("year", year)
        .eq("sheet_type", "sheet2")
        .order("row_number");

      if (error1 || error2) throw error1 || error2;

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Format data for sheet 1
      const formattedSheet1 = (sheet1Data || []).map((row) => ({
        "№": row.row_number,
        "Номер заявки": row.request_number,
        "Описание": row.description,
        "Сумма": row.amount,
        "Контрагент": row.contractor,
        "Статус": row.status,
        "Дата доставки": row.delivery_date,
        "Комментарии": row.comments,
      }));

      // Format data for sheet 2
      const formattedSheet2 = (sheet2Data || []).map((row) => ({
        "№": row.row_number,
        "Номер заявки": row.request_number,
        "Описание": row.description,
        "Сумма": row.amount,
        "Контрагент": row.contractor,
        "Статус": row.status,
        "Дата доставки": row.delivery_date,
        "Комментарии": row.comments,
      }));

      // Add sheets to workbook
      const worksheet1 = XLSX.utils.json_to_sheet(formattedSheet1);
      const worksheet2 = XLSX.utils.json_to_sheet(formattedSheet2);

      XLSX.utils.book_append_sheet(workbook, worksheet1, "Книга 1");
      XLSX.utils.book_append_sheet(workbook, worksheet2, "Книга 2");

      // Generate file name
      const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
      ];
      const fileName = `Приложение_${monthNames[month - 1]}_${year}.xlsx`;

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
