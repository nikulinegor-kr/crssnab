import { FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback } from "react";
import { ReportHeader } from "@/components/agent-report/ReportHeader";
import { ReportTable } from "@/components/agent-report/ReportTable";
import { ExportReportButton } from "@/components/agent-report/ExportReportButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Button } from "@/components/ui/button";
import { Request } from "@/hooks/useRequests";
import { Plus, Save } from "lucide-react";
import { ActCalculationTable } from "@/components/agent-act-report/ActCalculationTable";
import { ActAdditionalTable } from "@/components/agent-act-report/ActAdditionalTable";
import { ExportActReportButton } from "@/components/agent-act-report/ExportActReportButton";

const defaultHeader = {
  report_number: "1",
  contract_number: "1-21",
  contract_date: "2021-05-28",
  period_start: "2024-12-01",
  period_end: "2024-12-31",
  company_name: "ООО «САХАРЕСУРС»",
  company_address: "Республика Саха (Якутия), г. Нерюнгри, пос. Серебряный Бор, д. 401",
  company_phone: "тел./факс: +7 (4147) 6-46-62",
  recipient_name: "Переведенцев М.Л.",
  recipient_position: "Генеральный директор ООО«САХАРЕСУРС»"
};

const emptyRows = [
  { row_number: 1, tmc: "", contractor: "", invoice_number: "", amount: 0 },
  { row_number: 2, tmc: "", contractor: "", invoice_number: "", amount: 0 }
];

const months = [
  { value: 1, label: "Январь" }, { value: 2, label: "Февраль" },
  { value: 3, label: "Март" }, { value: 4, label: "Апрель" },
  { value: 5, label: "Май" }, { value: 6, label: "Июнь" },
  { value: 7, label: "Июль" }, { value: 8, label: "Август" },
  { value: 9, label: "Сентябрь" }, { value: 10, label: "Октябрь" },
  { value: 11, label: "Ноябрь" }, { value: 12, label: "Декабрь" },
];

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

const AgentReport = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [activeTab, setActiveTab] = useState("uu");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  // === Report (Отчет агента) state ===
  const [reportId, setReportId] = useState<string | null>(null);
  const [headerData, setHeaderData] = useState({ ...defaultHeader });
  const [rows, setRows] = useState([...emptyRows]);

  // === UU Report (Отчет агента - УУ) state ===
  const [uuReportId, setUuReportId] = useState<string | null>(null);
  const [uuHeaderData, setUuHeaderData] = useState({ ...defaultHeader });
  const [uuRows, setUuRows] = useState([...emptyRows]);

  // === Act Report (Отчет по акту) state ===
  const [actReportId, setActReportId] = useState<string | null>(null);
  const [calculationRows, setCalculationRows] = useState<CalculationRow[]>([]);
  const [additionalRows, setAdditionalRows] = useState<AdditionalRow[]>([]);
  const [agentCommission, setAgentCommission] = useState(0);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // Auto-update period when month/year changes
  useEffect(() => {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const mm = String(selectedMonth).padStart(2, '0');
    const periodUpdate = {
      period_start: `${selectedYear}-${mm}-01`,
      period_end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      report_number: selectedMonth.toString(),
    };
    setHeaderData(prev => ({ ...prev, ...periodUpdate }));
    setUuHeaderData(prev => ({ ...prev, ...periodUpdate }));
  }, [selectedMonth, selectedYear]);

  // Load all reports when month/year/org changes
  useEffect(() => {
    if (currentOrgId) {
      loadReport();
      loadUuReport();
      loadActReport();
      loadAgentCommission();
    }
  }, [selectedMonth, selectedYear, currentOrgId]);

  // ========== SHARED ==========
  const loadDataFromRequests = useCallback(async () => {
    if (!currentOrgId) return [];
    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .eq("organization_id", currentOrgId)
      .order("request_date", { ascending: false });
    if (error) throw error;

    const matchesMonth = (dateStr: string | null) => {
      if (!dateStr) return false;
      const [y, m] = dateStr.split("-");
      return y === selectedYear.toString() && String(parseInt(m, 10)) === selectedMonth.toString();
    };

    const filtered = (requests || []).filter((r: Request) => {
      if (!r.amount || r.amount === 0) return false;
      return matchesMonth(r.delivery_date) || matchesMonth(r.shipment_date);
    });

    return filtered.map((req: Request, index: number) => ({
      row_number: index + 1,
      tmc: req.description || "",
      contractor: req.contractor || "",
      invoice_number: req.invoice_number || "",
      amount: req.amount || 0
    }));
  }, [currentOrgId, selectedMonth, selectedYear]);

  const refreshFromRequests = async (target: "report" | "uu") => {
    try {
      const newRows = await loadDataFromRequests();
      const result = newRows.length > 0 ? newRows : [...emptyRows];
      if (target === "report") { setRows(result); setReportId(null); }
      else { setUuRows(result); setUuReportId(null); }
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  // ========== REPORT (Отчет агента) ==========
  const loadReport = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const { data: reportData, error } = await supabase
        .from("agent_report_data").select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;

      if (reportData) {
        setReportId(reportData.id);
        setHeaderData({
          report_number: reportData.report_number,
          contract_number: reportData.contract_number,
          contract_date: reportData.contract_date,
          period_start: reportData.period_start,
          period_end: reportData.period_end,
          company_name: reportData.company_name,
          company_address: reportData.company_address || "",
          company_phone: reportData.company_phone || "",
          recipient_name: reportData.recipient_name || "",
          recipient_position: reportData.recipient_position || ""
        });
        const { data: rowsData, error: rowsError } = await supabase
          .from("agent_report_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        if (rowsError) throw rowsError;
        if (rowsData?.length) {
          setRows(rowsData.map(r => ({
            id: r.id, row_number: r.row_number, tmc: r.tmc || "",
            contractor: r.contractor || "", invoice_number: r.invoice_number || "",
            amount: r.amount || 0, formula: r.formula || undefined
          })));
        }
      } else {
        await refreshFromRequests("report");
      }
    } catch (error) {
      console.error("Error loading report:", error);
      toast({ title: "Ошибка", description: "Не удалось загрузить данные", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async () => {
    if (!currentOrgId) return;
    try {
      let id = reportId;
      if (id) {
        const { error } = await supabase.from("agent_report_data")
          .update({ ...headerData, month: selectedMonth, year: selectedYear }).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("agent_report_data")
          .insert({ organization_id: currentOrgId, ...headerData, month: selectedMonth, year: selectedYear,
            created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
        if (error) throw error;
        id = data.id; setReportId(data.id);
      }
      if (id) {
        await supabase.from("agent_report_rows").delete().eq("report_id", id);
        const { error } = await supabase.from("agent_report_rows").insert(
          rows.map(r => ({ report_id: id, row_number: r.row_number, tmc: r.tmc,
            contractor: r.contractor, invoice_number: r.invoice_number,
            amount: typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0, formula: null }))
        );
        if (error) throw error;
      }
      toast({ title: "Успешно", description: "Отчет сохранен" });
    } catch (error) {
      console.error("Error saving report:", error);
      toast({ title: "Ошибка", description: "Не удалось сохранить отчет", variant: "destructive" });
    }
  };

  // ========== UU REPORT (Отчет агента - УУ) ==========
  const loadUuReport = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData, error } = await supabase
        .from("agent_report_uu_data").select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;

      if (reportData) {
        setUuReportId(reportData.id);
        setUuHeaderData({
          report_number: reportData.report_number,
          contract_number: reportData.contract_number,
          contract_date: reportData.contract_date,
          period_start: reportData.period_start,
          period_end: reportData.period_end,
          company_name: reportData.company_name,
          company_address: reportData.company_address || "",
          company_phone: reportData.company_phone || "",
          recipient_name: reportData.recipient_name || "",
          recipient_position: reportData.recipient_position || ""
        });
        const { data: rowsData, error: rowsError } = await supabase
          .from("agent_report_uu_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        if (rowsError) throw rowsError;
        if (rowsData?.length) {
          setUuRows(rowsData.map(r => ({
            id: r.id, row_number: r.row_number, tmc: r.tmc || "",
            contractor: r.contractor || "", invoice_number: r.invoice_number || "",
            amount: r.amount || 0, formula: r.formula || undefined
          })));
        }
      } else {
        await refreshFromRequests("uu");
      }
    } catch (error) {
      console.error("Error loading UU report:", error);
    }
  };

  const saveUuReport = async () => {
    if (!currentOrgId) return;
    try {
      let id = uuReportId;
      if (id) {
        const { error } = await supabase.from("agent_report_uu_data")
          .update({ ...uuHeaderData, month: selectedMonth, year: selectedYear }).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("agent_report_uu_data")
          .insert({ organization_id: currentOrgId, ...uuHeaderData, month: selectedMonth, year: selectedYear,
            created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
        if (error) throw error;
        id = data.id; setUuReportId(data.id);
      }
      if (id) {
        await supabase.from("agent_report_uu_rows").delete().eq("report_id", id);
        const { error } = await supabase.from("agent_report_uu_rows").insert(
          uuRows.map(r => ({ report_id: id, row_number: r.row_number, tmc: r.tmc,
            contractor: r.contractor, invoice_number: r.invoice_number,
            amount: typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount)) || 0, formula: null }))
        );
        if (error) throw error;
      }
      toast({ title: "Успешно", description: "Отчет УУ сохранен" });
    } catch (error) {
      console.error("Error saving UU report:", error);
      toast({ title: "Ошибка", description: "Не удалось сохранить отчет УУ", variant: "destructive" });
    }
  };

  // ========== ACT REPORT (Отчет по акту) ==========
  const calculateCommission = (total: number) => {
    return total * 0.08;
  };

  const loadAgentCommission = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData } = await supabase.from("agent_report_data").select("id")
        .eq("organization_id", currentOrgId).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (reportData) {
        const { data: rowsData } = await supabase.from("agent_report_rows").select("amount").eq("report_id", reportData.id);
        const total = rowsData?.reduce((sum, row) => sum + (row.amount || 0), 0) || 0;
        setAgentCommission(calculateCommission(total));
      } else { setAgentCommission(0); }
    } catch { setAgentCommission(0); }
  };

  const loadActReport = async () => {
    if (!currentOrgId) return;
    try {
      const { data: reportData, error } = await supabase.from("agent_act_report_data").select("*")
        .eq("organization_id", currentOrgId).eq("month", selectedMonth).eq("year", selectedYear).maybeSingle();
      if (error) throw error;
      if (reportData) {
        setActReportId(reportData.id);
        const { data: calcData } = await supabase.from("agent_act_calculation_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        const { data: addData } = await supabase.from("agent_act_additional_rows").select("*")
          .eq("report_id", reportData.id).order("row_number");
        const checkAmountTotal = (addData || []).reduce((sum, row) => sum + (row.amount || 0), 0);
        const processed = (calcData || []).map(row => {
          const p = { ...row };
          if (row.salary_with_commission) {
            p.tax_7_percent = parseFloat((row.salary_with_commission * 0.07).toFixed(2));
            p.remainder_after_tax = parseFloat((row.salary_with_commission + checkAmountTotal).toFixed(2));
            p.act_amount = parseFloat(((p.remainder_after_tax / 93) * 100).toFixed(2));
          }
          return p;
        });
        setCalculationRows(processed);
        setAdditionalRows(addData || []);
      } else {
        setActReportId(null); setCalculationRows([]); setAdditionalRows([]);
      }
    } catch (error) {
      console.error("Error loading act report:", error);
    }
  };

  const saveActReport = async () => {
    if (!currentOrgId) return;
    try {
      let id = actReportId;
      if (!id) {
        const { data, error } = await supabase.from("agent_act_report_data")
          .insert({ organization_id: currentOrgId, month: selectedMonth, year: selectedYear }).select().single();
        if (error) throw error;
        id = data.id; setActReportId(id);
      }
      for (const row of calculationRows) {
        if (row.id.startsWith("new-")) {
          const { id: _, ...rd } = row;
          await supabase.from("agent_act_calculation_rows").insert({ ...rd, report_id: id });
        } else {
          const { id: _, ...rd } = row;
          await supabase.from("agent_act_calculation_rows").update(rd).eq("id", row.id);
        }
      }
      for (const row of additionalRows) {
        if (row.id.startsWith("new-")) {
          const { id: _, ...rd } = row;
          await supabase.from("agent_act_additional_rows").insert({ ...rd, report_id: id });
        } else {
          const { id: _, ...rd } = row;
          await supabase.from("agent_act_additional_rows").update(rd).eq("id", row.id);
        }
      }
      await loadActReport();
      toast({ title: "Успешно", description: "Отчет по акту сохранен" });
    } catch (error) {
      console.error("Error saving act report:", error);
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    }
  };

  const addCalculationRow = () => {
    const baseSalary = 30000 + agentCommission;
    const checkAmountTotal = additionalRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const remainder = baseSalary + checkAmountTotal;
    setCalculationRows([...calculationRows, {
      id: `new-${Date.now()}`, row_number: calculationRows.length + 1,
      transfer_date: null, transferred_amount: null,
      tax_7_percent: parseFloat((baseSalary * 0.07).toFixed(2)),
      remainder_after_tax: parseFloat(remainder.toFixed(2)),
      salary_with_commission: baseSalary, check_amount: null,
      act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)), formula: null,
    }]);
  };

  const addAdditionalRow = () => {
    setAdditionalRows([...additionalRows, {
      id: `new-${Date.now()}`, row_number: additionalRows.length + 1,
      description: null, amount: null,
    }]);
  };

  const deleteCalculationRow = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("agent_act_calculation_rows").delete().eq("id", id);
    setCalculationRows(calculationRows.filter(r => r.id !== id));
  };

  const deleteAdditionalRow = async (id: string) => {
    if (!id.startsWith("new-")) await supabase.from("agent_act_additional_rows").delete().eq("id", id);
    const updated = additionalRows.filter(r => r.id !== id);
    setAdditionalRows(updated);
    const checkTotal = updated.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (!row.salary_with_commission) return row;
      const remainder = parseFloat((row.salary_with_commission + checkTotal).toFixed(2));
      return { ...row, remainder_after_tax: remainder, act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)) };
    }));
  };

  const updateCalculationRow = (id: string, field: keyof CalculationRow, value: any) => {
    const checkTotal = additionalRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (row.id !== id) return row;
      const u = { ...row, [field]: value };
      if (field === "transferred_amount" && value !== null) u.salary_with_commission = 30000 + agentCommission;
      if (field === "salary_with_commission" && value !== null) {
        u.tax_7_percent = parseFloat((value * 0.07).toFixed(2));
        u.remainder_after_tax = parseFloat((value + checkTotal).toFixed(2));
        u.act_amount = parseFloat(((u.remainder_after_tax / 93) * 100).toFixed(2));
      }
      return u;
    }));
  };

  const updateAdditionalRow = (id: string, field: keyof AdditionalRow, value: any) => {
    const updated = additionalRows.map(r => r.id === id ? { ...r, [field]: value } : r);
    setAdditionalRows(updated);
    const checkTotal = updated.reduce((sum, r) => sum + (r.amount || 0), 0);
    setCalculationRows(calculationRows.map(row => {
      if (!row.salary_with_commission) return row;
      const remainder = parseFloat((row.salary_with_commission + checkTotal).toFixed(2));
      return { ...row, remainder_after_tax: remainder, act_amount: parseFloat(((remainder / 93) * 100).toFixed(2)) };
    }));
  };

  // ========== RENDER ==========
  const renderReportContent = (
    title: string,
    hData: typeof headerData,
    setHData: typeof setHeaderData,
    rRows: typeof rows,
    setRRows: typeof setRows,
    onSave: () => void,
    onRefresh: () => void,
    exportBtn: React.ReactNode
  ) => (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={onSave} size="sm">Сохранить</Button>
        <Button onClick={onRefresh} variant="outline" size="sm">🔄 Из заявок</Button>
        {exportBtn}
      </div>
      <Card className="p-6 space-y-6 bg-background">
        <ReportHeader
          data={hData}
          onChange={(field, value) => setHData(prev => ({ ...prev, [field]: value }))}
          title={title}
        />
        <ReportTable
          rows={rRows}
          onChange={setRRows}
          contractNumber={hData.contract_number}
          contractDate={hData.contract_date}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          months={months}
        />
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm">
            Прошу предоставить возражения, при их наличии, в 5-дневный срок, в соответствии с условиями агентского договора.
          </p>
        </div>
        <div className="flex justify-between pt-6">
          <div className="space-y-1">
            <p className="text-sm">Отчет сдал: _____________________</p>
            <p className="text-sm">ИП Никулин Егор Викторович</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm">Отчет принял: _____________________</p>
            <p className="text-sm">{hData.recipient_position}</p>
            <p className="text-sm">{hData.recipient_name}</p>
          </div>
        </div>
      </Card>
    </>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen overflow-x-auto">
      <div className="space-y-6 p-4 sm:p-6 min-w-[600px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Отчет агента</h1>
              <p className="text-xs sm:text-base text-muted-foreground">Все отчёты агента на одной странице</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[120px] sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="uu">Отчет агента - УУ</TabsTrigger>
            <TabsTrigger value="report">Отчет агента</TabsTrigger>
            <TabsTrigger value="act">Отчет по акту</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="mt-4">
            {renderReportContent(
              "Отчет агента", headerData, setHeaderData, rows, setRows,
              saveReport, () => refreshFromRequests("report"),
              <ExportReportButton headerData={headerData} rows={rows} month={selectedMonth} year={selectedYear} />
            )}
          </TabsContent>

          <TabsContent value="uu" className="mt-4">
            {renderReportContent(
              "Отчет агента - УУ", uuHeaderData, setUuHeaderData, uuRows, setUuRows,
              saveUuReport, () => refreshFromRequests("uu"),
              <ExportReportButton headerData={uuHeaderData} rows={uuRows} month={selectedMonth} year={selectedYear} />
            )}
          </TabsContent>

          <TabsContent value="act" className="mt-4">
            <div className="space-y-6">
              {agentCommission > 0 && (
                <p className="text-sm text-muted-foreground">
                  Вознаграждение агента за период: {agentCommission.toFixed(2)} ₽
                </p>
              )}

              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Расчет суммы вознаграждения</h2>
                  <Button onClick={addCalculationRow} size="sm">
                    <Plus className="h-4 w-4 mr-2" />Добавить строку
                  </Button>
                </div>
                <ActCalculationTable
                  rows={calculationRows}
                  onUpdate={updateCalculationRow}
                  onDelete={deleteCalculationRow}
                  agentCommission={agentCommission}
                  additionalRows={additionalRows}
                />
              </Card>

              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Чеки</h2>
                  <Button onClick={addAdditionalRow} size="sm">
                    <Plus className="h-4 w-4 mr-2" />Добавить строку
                  </Button>
                </div>
                <ActAdditionalTable
                  rows={additionalRows}
                  onUpdate={updateAdditionalRow}
                  onDelete={deleteAdditionalRow}
                />
              </Card>

              <div className="flex justify-end gap-2">
                <ExportActReportButton
                  calculationRows={calculationRows}
                  additionalRows={additionalRows}
                  month={selectedMonth}
                  year={selectedYear}
                />
                <Button onClick={saveActReport}>
                  <Save className="h-4 w-4 mr-2" />Сохранить
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AgentReport;
