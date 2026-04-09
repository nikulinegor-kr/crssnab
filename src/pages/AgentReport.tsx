import { FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ReportHeader } from "@/components/agent-report/ReportHeader";
import { ReportTable } from "@/components/agent-report/ReportTable";
import { ExportReportButton } from "@/components/agent-report/ExportReportButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Button } from "@/components/ui/button";
import { Request } from "@/hooks/useRequests";

const AgentReport = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();

  const [headerData, setHeaderData] = useState({
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
  });

  const [rows, setRows] = useState([
    { row_number: 1, tmc: "", contractor: "", invoice_number: "", amount: 0 },
    { row_number: 2, tmc: "", contractor: "", invoice_number: "", amount: 0 }
  ]);

  const months = [
    { value: 1, label: "Январь" },
    { value: 2, label: "Февраль" },
    { value: 3, label: "Март" },
    { value: 4, label: "Апрель" },
    { value: 5, label: "Май" },
    { value: 6, label: "Июнь" },
    { value: 7, label: "Июль" },
    { value: 8, label: "Август" },
    { value: 9, label: "Сентябрь" },
    { value: 10, label: "Октябрь" },
    { value: 11, label: "Ноябрь" },
    { value: 12, label: "Декабрь" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  useEffect(() => {
    // Auto-update period and report number when month/year changes
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const mm = String(selectedMonth).padStart(2, '0');
    setHeaderData(prev => ({
      ...prev,
      period_start: `${selectedYear}-${mm}-01`,
      period_end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      report_number: selectedMonth.toString(),
    }));
    loadReport();
  }, [selectedMonth, selectedYear, currentOrgId]);

  const loadReport = async () => {
    if (!currentOrgId) return;

    setLoading(true);
    try {
      const { data: reportData, error: reportError } = await supabase
        .from("agent_report_data")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .maybeSingle();

      if (reportError) throw reportError;

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
          .from("agent_report_rows")
          .select("*")
          .eq("report_id", reportData.id)
          .order("row_number");

        if (rowsError) throw rowsError;

        if (rowsData && rowsData.length > 0) {
          setRows(rowsData.map(r => ({
            id: r.id,
            row_number: r.row_number,
            tmc: r.tmc || "",
            contractor: r.contractor || "",
            invoice_number: r.invoice_number || "",
            amount: r.amount || 0,
            formula: r.formula || undefined
          })));
        }
      } else {
        // Load data from requests automatically
        await loadDataFromRequests();
      }
    } catch (error) {
      console.error("Error loading report:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDataFromRequests = async () => {
    if (!currentOrgId) return;

    try {
      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("request_date", { ascending: false });

      if (error) throw error;

      // Filter requests by month/year and status
      const filteredRequests = (requests || []).filter((request: Request) => {
        const validStatuses = ["В пути", "Доставлено", "Доставлено в ТК"];
        if (!validStatuses.includes(request.status)) return false;
        if (!request.amount || request.amount === 0) return false;

        const dateToCheck = request.delivery_date || request.shipment_date;
        if (!dateToCheck) return false;

        const [yearStr, monthStr] = dateToCheck.split("-");
        if (!yearStr || !monthStr) return false;

        return (
          yearStr === selectedYear.toString() &&
          String(parseInt(monthStr, 10)) === selectedMonth.toString()
        );
      });

      // Convert to rows
      const newRows = filteredRequests.map((req: Request, index: number) => ({
        row_number: index + 1,
        tmc: req.description || "",
        contractor: req.contractor || "",
        invoice_number: req.invoice_number || "",
        amount: req.amount || 0
      }));

      setRows(newRows.length > 0 ? newRows : [
        { row_number: 1, tmc: "", contractor: "", invoice_number: "", amount: 0 },
        { row_number: 2, tmc: "", contractor: "", invoice_number: "", amount: 0 }
      ]);
      setReportId(null);
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  const saveReport = async () => {
    if (!currentOrgId) return;

    try {
      let currentReportId = reportId;

      // Save or update header data
      if (reportId) {
        const { error } = await supabase
          .from("agent_report_data")
          .update({
            ...headerData,
            month: selectedMonth,
            year: selectedYear
          })
          .eq("id", reportId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("agent_report_data")
          .insert({
            organization_id: currentOrgId,
            ...headerData,
            month: selectedMonth,
            year: selectedYear,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();
        if (error) throw error;
        currentReportId = data.id;
        setReportId(data.id);
      }

      // Delete existing rows
      if (currentReportId) {
        await supabase
          .from("agent_report_rows")
          .delete()
          .eq("report_id", currentReportId);

        // Insert new rows
        const rowsToInsert = rows.map(row => ({
          report_id: currentReportId,
          row_number: row.row_number,
          tmc: row.tmc,
          contractor: row.contractor,
          invoice_number: row.invoice_number,
          amount: typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount)) || 0,
          formula: null
        }));

        const { error } = await supabase
          .from("agent_report_rows")
          .insert(rowsToInsert);
        if (error) throw error;
      }

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
    }
  };

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
              <p className="text-xs sm:text-base text-muted-foreground">Редактирование отчета с данными из заявок</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[120px] sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={saveReport} size="sm" className="sm:size-default">Сохранить</Button>
            <Button onClick={loadDataFromRequests} variant="outline" size="sm" className="sm:size-default">🔄 Из заявок</Button>
            <ExportReportButton 
              headerData={headerData}
              rows={rows}
              month={selectedMonth} 
              year={selectedYear} 
            />
          </div>
        </div>

      <Card className="p-6 space-y-6 bg-background">
        <ReportHeader 
          data={headerData}
          onChange={(field, value) => setHeaderData(prev => ({ ...prev, [field]: value }))}
          title="Отчет агента"
        />
        
        <ReportTable 
          rows={rows}
          onChange={setRows}
          contractNumber={headerData.contract_number}
          contractDate={headerData.contract_date}
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
            <p className="text-sm">{headerData.recipient_position}</p>
            <p className="text-sm">{headerData.recipient_name}</p>
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
};

export default AgentReport;
