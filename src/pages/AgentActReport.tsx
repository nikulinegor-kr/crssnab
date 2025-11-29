import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActCalculationTable } from "@/components/agent-act-report/ActCalculationTable";
import { ActAdditionalTable } from "@/components/agent-act-report/ActAdditionalTable";
import { ExportActReportButton } from "@/components/agent-act-report/ExportActReportButton";

interface CalculationRow {
  id: string;
  row_number: number;
  transfer_date: string | null;
  transferred_amount: number | null;
  tax_7_percent: number | null;
  remainder_after_tax: number | null;
  salary_with_commission: number | null;
  check_amount: number | null;
  act_amount: number | null;
  formula: string | null;
}

interface AdditionalRow {
  id: string;
  row_number: number;
  description: string | null;
  amount: number | null;
}

export default function AgentActReport() {
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [reportId, setReportId] = useState<string | null>(null);
  const [calculationRows, setCalculationRows] = useState<CalculationRow[]>([]);
  const [additionalRows, setAdditionalRows] = useState<AdditionalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentCommission, setAgentCommission] = useState<number>(0);

  useEffect(() => {
    if (currentOrgId) {
      loadReport();
      loadAgentCommission();
    }
  }, [month, year, currentOrgId]);

  const calculateCommission = (total: number): number => {
    let commission = 0;
    if (total >= 10000000) {
      commission = 5000000 * 0.02 + 5000000 * 0.01 + (total - 10000000) * 0.005;
    } else if (total >= 5000000) {
      commission = 5000000 * 0.02 + (total - 5000000) * 0.01;
    } else {
      commission = total * 0.02;
    }
    return commission;
  };

  const loadAgentCommission = async () => {
    if (!currentOrgId) return;

    try {
      const { data: reportData, error: reportError } = await supabase
        .from("agent_report_data")
        .select("id")
        .eq("organization_id", currentOrgId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (reportError) throw reportError;

      if (reportData) {
        const { data: rowsData, error: rowsError } = await supabase
          .from("agent_report_rows")
          .select("amount")
          .eq("report_id", reportData.id);

        if (rowsError) throw rowsError;

        const total = rowsData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;
        const commission = calculateCommission(total);
        setAgentCommission(commission);
      } else {
        setAgentCommission(0);
      }
    } catch (error) {
      console.error("Error loading agent commission:", error);
      setAgentCommission(0);
    }
  };

  const loadReport = async () => {
    if (!currentOrgId) return;

    setLoading(true);
    try {
      const { data: reportData, error: reportError } = await supabase
        .from("agent_act_report_data")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (reportError) throw reportError;

      if (reportData) {
        setReportId(reportData.id);
        await loadRows(reportData.id);
      } else {
        setReportId(null);
        setCalculationRows([]);
        setAdditionalRows([]);
      }
    } catch (error) {
      console.error("Error loading report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить отчет",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRows = async (id: string) => {
    const { data: calcData, error: calcError } = await supabase
      .from("agent_act_calculation_rows")
      .select("*")
      .eq("report_id", id)
      .order("row_number");

    const { data: addData, error: addError } = await supabase
      .from("agent_act_additional_rows")
      .select("*")
      .eq("report_id", id)
      .order("row_number");

    if (calcError) throw calcError;
    if (addError) throw addError;

    // Сумма по чекам из дополнительных позиций
    const checkAmountTotal = (addData || []).reduce((sum, row) => sum + (row.amount || 0), 0);

    // Применяем автоматические расчеты к загруженным данным
    const processedCalcData = (calcData || []).map(row => {
      const processed = { ...row };
      
      // Если есть зарплата с комиссией, пересчитываем остаток и сумму акта
      if (row.salary_with_commission) {
        // Остаток = зарплата + сумма по чекам
        processed.remainder_after_tax = parseFloat((row.salary_with_commission + checkAmountTotal).toFixed(2));
        
        // Сумма акта
        const actAmount = (processed.remainder_after_tax / 93) * 100;
        processed.act_amount = parseFloat(actAmount.toFixed(2));
      }
      
      return processed;
    });

    setCalculationRows(processedCalcData);
    setAdditionalRows(addData || []);
  };

  const createReport = async () => {
    if (!currentOrgId) return null;

    const { data, error } = await supabase
      .from("agent_act_report_data")
      .insert({
        organization_id: currentOrgId,
        month,
        year,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  };

  const handleSave = async () => {
    if (!currentOrgId) return;

    setLoading(true);
    try {
      let currentReportId = reportId;

      if (!currentReportId) {
        currentReportId = await createReport();
        setReportId(currentReportId);
      }

      // Save calculation rows
      for (const row of calculationRows) {
        if (row.id.startsWith("new-")) {
          const { id, ...rowData } = row;
          await supabase.from("agent_act_calculation_rows").insert({
            ...rowData,
            report_id: currentReportId,
          });
        } else {
          const { id, ...rowData } = row;
          await supabase
            .from("agent_act_calculation_rows")
            .update(rowData)
            .eq("id", id);
        }
      }

      // Save additional rows
      for (const row of additionalRows) {
        if (row.id.startsWith("new-")) {
          const { id, ...rowData } = row;
          await supabase.from("agent_act_additional_rows").insert({
            ...rowData,
            report_id: currentReportId,
          });
        } else {
          const { id, ...rowData } = row;
          await supabase
            .from("agent_act_additional_rows")
            .update(rowData)
            .eq("id", id);
        }
      }

      await loadReport();

      toast({
        title: "Успешно",
        description: "Отчет сохранен",
      });
    } catch (error) {
      console.error("Error saving report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить отчет",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCalculationRow = () => {
    const baseSalary = 30000 + agentCommission;
    const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    const remainder = baseSalary + checkAmountTotal;
    const actAmount = (remainder / 93) * 100;
    
    const newRow: CalculationRow = {
      id: `new-${Date.now()}`,
      row_number: calculationRows.length + 1,
      transfer_date: null,
      transferred_amount: null,
      tax_7_percent: parseFloat((baseSalary * 0.07).toFixed(2)),
      remainder_after_tax: parseFloat(remainder.toFixed(2)),
      salary_with_commission: baseSalary,
      check_amount: null,
      act_amount: parseFloat(actAmount.toFixed(2)),
      formula: null,
    };
    setCalculationRows([...calculationRows, newRow]);
  };

  const addAdditionalRow = () => {
    const newRow: AdditionalRow = {
      id: `new-${Date.now()}`,
      row_number: additionalRows.length + 1,
      description: null,
      amount: null,
    };
    setAdditionalRows([...additionalRows, newRow]);
  };

  const deleteCalculationRow = async (id: string) => {
    if (!id.startsWith("new-")) {
      await supabase.from("agent_act_calculation_rows").delete().eq("id", id);
    }
    setCalculationRows(calculationRows.filter((row) => row.id !== id));
  };

  const deleteAdditionalRow = async (id: string) => {
    if (!id.startsWith("new-")) {
      await supabase.from("agent_act_additional_rows").delete().eq("id", id);
    }
    const updatedAdditionalRows = additionalRows.filter((row) => row.id !== id);
    setAdditionalRows(updatedAdditionalRows);
    
    // Пересчитываем сумму по чекам после удаления
    const checkAmountTotal = updatedAdditionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    
    // Обновляем все строки расчета с новой суммой по чекам
    setCalculationRows(
      calculationRows.map((row) => {
        const updatedRow = { ...row };
        
        // Пересчитываем остаток = зарплата + сумма по чекам
        if (row.salary_with_commission) {
          updatedRow.remainder_after_tax = parseFloat((row.salary_with_commission + checkAmountTotal).toFixed(2));
          
          // Пересчитываем сумму акта
          const actAmount = (updatedRow.remainder_after_tax / 93) * 100;
          updatedRow.act_amount = parseFloat(actAmount.toFixed(2));
        }
        
        return updatedRow;
      })
    );
  };

  const updateCalculationRow = (id: string, field: keyof CalculationRow, value: any) => {
    // Сумма по чекам из дополнительных позиций
    const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

    setCalculationRows(
      calculationRows.map((row) => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          
          // Если изменилась перечисленная сумма, обновляем зарплату с комиссией
          if (field === "transferred_amount" && value !== null) {
            updatedRow.salary_with_commission = 30000 + agentCommission;
          }
          
          // Если изменилась зарплата, пересчитываем остаток = зарплата + сумма по чекам
          if (field === "salary_with_commission" && value !== null) {
            updatedRow.remainder_after_tax = parseFloat((value + checkAmountTotal).toFixed(2));
            
            // Пересчитываем сумму акта
            const actAmount = (updatedRow.remainder_after_tax / 93) * 100;
            updatedRow.act_amount = parseFloat(actAmount.toFixed(2));
          }
          
          return updatedRow;
        }
        return row;
      })
    );
  };

  const updateAdditionalRow = (id: string, field: keyof AdditionalRow, value: any) => {
    const updatedAdditionalRows = additionalRows.map((row) => (row.id === id ? { ...row, [field]: value } : row));
    setAdditionalRows(updatedAdditionalRows);
    
    // Пересчитываем сумму по чекам
    const checkAmountTotal = updatedAdditionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    
    // Обновляем все строки расчета с новой суммой по чекам
    setCalculationRows(
      calculationRows.map((row) => {
        const updatedRow = { ...row };
        
        // Пересчитываем остаток = зарплата + сумма по чекам
        if (row.salary_with_commission) {
          updatedRow.remainder_after_tax = parseFloat((row.salary_with_commission + checkAmountTotal).toFixed(2));
          
          // Пересчитываем сумму акта
          const actAmount = (updatedRow.remainder_after_tax / 93) * 100;
          updatedRow.act_amount = parseFloat(actAmount.toFixed(2));
        }
        
        return updatedRow;
      })
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Отчет агента по акту</h1>
          {agentCommission > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Вознаграждение агента за период: {agentCommission.toFixed(2)} ₽
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Январь",
                "Февраль",
                "Март",
                "Апрель",
                "Май",
                "Июнь",
                "Июль",
                "Август",
                "Сентябрь",
                "Октябрь",
                "Ноябрь",
                "Декабрь",
              ].map((name, idx) => (
                <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(
                (y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Расчет суммы вознаграждения</h2>
            <div className="flex gap-2">
              <Button onClick={addCalculationRow} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Добавить строку
              </Button>
            </div>
          </div>

          <ActCalculationTable
            rows={calculationRows}
            onUpdate={updateCalculationRow}
            onDelete={deleteCalculationRow}
            agentCommission={agentCommission}
            additionalRows={additionalRows}
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Дополнительные позиции</h2>
            <div className="flex gap-2">
              <Button onClick={addAdditionalRow} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Добавить строку
              </Button>
            </div>
          </div>

          <ActAdditionalTable
            rows={additionalRows}
            onUpdate={updateAdditionalRow}
            onDelete={deleteAdditionalRow}
          />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <ExportActReportButton
          calculationRows={calculationRows}
          additionalRows={additionalRows}
          month={month}
          year={year}
        />
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          Сохранить
        </Button>
      </div>
    </div>
  );
}
