import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

interface TableRow {
  id?: string;
  row_number: number;
  request_number: string;
  description: string;
  amount: number;
  contractor: string;
  status: string;
  delivery_date: string;
  comments: string;
}

interface EditableTableProps {
  month: number;
  year: number;
  sheetType: "sheet1" | "sheet2";
}

export const EditableTable = ({ month, year, sheetType }: EditableTableProps) => {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  useEffect(() => {
    loadData();
  }, [month, year, sheetType, currentOrgId]);

  const loadData = async () => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appendix_data")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", month)
        .eq("year", year)
        .eq("sheet_type", sheetType)
        .order("row_number");

      if (error) throw error;

      if (data && data.length > 0) {
        setRows(data.map(d => ({
          id: d.id,
          row_number: d.row_number,
          request_number: d.request_number || "",
          description: d.description || "",
          amount: d.amount || 0,
          contractor: d.contractor || "",
          status: d.status || "",
          delivery_date: d.delivery_date || "",
          comments: d.comments || ""
        })));
      } else {
        // Initialize with 10 empty rows
        setRows(Array.from({ length: 10 }, (_, i) => ({
          row_number: i + 1,
          request_number: "",
          description: "",
          amount: 0,
          contractor: "",
          status: "",
          delivery_date: "",
          comments: ""
        })));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRow = async (row: TableRow) => {
    if (!currentOrgId) return;

    try {
      const dataToSave = {
        organization_id: currentOrgId,
        month,
        year,
        sheet_type: sheetType,
        row_number: row.row_number,
        request_number: row.request_number,
        description: row.description,
        amount: row.amount,
        contractor: row.contractor,
        status: row.status,
        delivery_date: row.delivery_date || null,
        comments: row.comments,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      if (row.id) {
        const { error } = await supabase
          .from("appendix_data")
          .update(dataToSave)
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("appendix_data")
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        
        // Update row with ID
        setRows(prev => prev.map(r => 
          r.row_number === row.row_number ? { ...r, id: data.id } : r
        ));
      }
    } catch (error) {
      console.error("Error saving row:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить данные",
        variant: "destructive",
      });
    }
  };

  const updateRow = (rowNumber: number, field: keyof TableRow, value: any) => {
    setRows(prev => {
      const updated = prev.map(r => 
        r.row_number === rowNumber ? { ...r, [field]: value } : r
      );
      
      // Auto-save after update
      const updatedRow = updated.find(r => r.row_number === rowNumber);
      if (updatedRow) {
        saveRow(updatedRow);
      }
      
      return updated;
    });
  };

  const addRow = () => {
    const newRowNumber = rows.length + 1;
    setRows(prev => [...prev, {
      row_number: newRowNumber,
      request_number: "",
      description: "",
      amount: 0,
      contractor: "",
      status: "",
      delivery_date: "",
      comments: ""
    }]);
  };

  const deleteRow = async (row: TableRow) => {
    if (!row.id) {
      setRows(prev => prev.filter(r => r.row_number !== row.row_number));
      return;
    }

    try {
      const { error } = await supabase
        .from("appendix_data")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setRows(prev => prev.filter(r => r.row_number !== row.row_number));
      toast({
        title: "Успешно",
        description: "Строка удалена",
      });
    } catch (error) {
      console.error("Error deleting row:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить строку",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left font-semibold">№</th>
              <th className="border border-border p-2 text-left font-semibold">Номер заявки</th>
              <th className="border border-border p-2 text-left font-semibold">Описание</th>
              <th className="border border-border p-2 text-left font-semibold">Сумма</th>
              <th className="border border-border p-2 text-left font-semibold">Контрагент</th>
              <th className="border border-border p-2 text-left font-semibold">Статус</th>
              <th className="border border-border p-2 text-left font-semibold">Дата доставки</th>
              <th className="border border-border p-2 text-left font-semibold">Комментарии</th>
              <th className="border border-border p-2 text-left font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_number} className="hover:bg-accent/50">
                <td className="border border-border p-2">{row.row_number}</td>
                <td className="border border-border p-2">
                  <Input
                    value={row.request_number}
                    onChange={(e) => updateRow(row.row_number, "request_number", e.target.value)}
                    className="min-w-[120px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Textarea
                    value={row.description}
                    onChange={(e) => updateRow(row.row_number, "description", e.target.value)}
                    className="min-w-[200px] min-h-[60px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateRow(row.row_number, "amount", parseFloat(e.target.value) || 0)}
                    className="min-w-[100px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Input
                    value={row.contractor}
                    onChange={(e) => updateRow(row.row_number, "contractor", e.target.value)}
                    className="min-w-[150px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Input
                    value={row.status}
                    onChange={(e) => updateRow(row.row_number, "status", e.target.value)}
                    className="min-w-[120px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Input
                    type="date"
                    value={row.delivery_date}
                    onChange={(e) => updateRow(row.row_number, "delivery_date", e.target.value)}
                    className="min-w-[140px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Textarea
                    value={row.comments}
                    onChange={(e) => updateRow(row.row_number, "comments", e.target.value)}
                    className="min-w-[200px] min-h-[60px]"
                  />
                </td>
                <td className="border border-border p-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(row)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <Button onClick={addRow} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Добавить строку
      </Button>
    </div>
  );
};
