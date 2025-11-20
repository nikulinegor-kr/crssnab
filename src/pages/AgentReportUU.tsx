import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Request } from "@/hooks/useRequests";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AgentReportUU() {
  const { currentOrgId } = useCurrentOrganization();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("request_date", { ascending: false});

      if (error) throw error;
      return data as Request[];
    },
    enabled: !!currentOrgId,
  });

  // Filter requests by selected month/year based on delivery/shipment date
  const filteredRequests = (requests || []).filter((request) => {
    // Check status - must be "В пути" or "Доставлено"
    const validStatuses = ["В пути", "Доставлено"];
    if (!validStatuses.includes(request.status)) {
      return false;
    }

    // Check if amount exists
    if (!request.amount || request.amount === 0) {
      return false;
    }

    // Check delivery_date or shipment_date (priority to delivery_date)
    const dateToCheck = request.delivery_date || request.shipment_date;
    if (!dateToCheck) {
      return false;
    }

    // Use raw date string (YYYY-MM-DD) to avoid timezone issues
    const [yearStr, monthStr] = dateToCheck.split("-");
    if (!yearStr || !monthStr) {
      return false;
    }

    return (
      yearStr === selectedYear &&
      String(parseInt(monthStr, 10)) === selectedMonth
    );
  });

  const months = [
    { value: "1", label: "Январь" },
    { value: "2", label: "Февраль" },
    { value: "3", label: "Март" },
    { value: "4", label: "Апрель" },
    { value: "5", label: "Май" },
    { value: "6", label: "Июнь" },
    { value: "7", label: "Июль" },
    { value: "8", label: "Август" },
    { value: "9", label: "Сентябрь" },
    { value: "10", label: "Октябрь" },
    { value: "11", label: "Ноябрь" },
    { value: "12", label: "Декабрь" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = currentDate.getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  const selectedRequestsForExport = filteredRequests.filter(req => selectedRows.has(req.id));
  const requestsToExport = selectedRows.size > 0 ? selectedRequestsForExport : filteredRequests;

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredRequests.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRequests.map(r => r.id)));
    }
  };

  const exportToExcel = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
    // Подготовка данных для экспорта
    const excelData = requestsToExport.map((request) => ({
      "ТМЦ": request.description || "",
      "Контрагент": request.contractor || "",
      "№ Счета": request.invoice_number || "",
      "Сумма закупа": request.amount || 0
    }));

    // Создание worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Установка ширины колонок
    ws['!cols'] = [
      { wch: 40 }, // ТМЦ
      { wch: 25 }, // Контрагент
      { wch: 15 }, // № Счета
      { wch: 15 }  // Сумма закупа
    ];

    // Создание workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Отчет агента УУ");

    // Скачивание файла
    const filename = `Отчет_агента_УУ_${monthName}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportToPDF = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text("Отчет агента - УУ", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`За период: ${monthName} ${selectedYear}`, 105, 30, { align: "center" });

    // Prepare table data
    const tableData = requestsToExport.map((req, index) => [
      (index + 1).toString(),
      req.description,
      req.contractor || "Не указан",
      req.invoice_number || "Не указан",
      req.amount ? req.amount.toFixed(2) : "0.00",
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["№", "ТМЦ", "Контрагент", "№ Счета", "Сумма закупа"]],
      body: tableData,
      styles: { font: "helvetica", fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Отчет_агента_УУ_${monthName}_${selectedYear}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Отчет агента - УУ</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Отчет по закупкам ТМЦ за выбранный период (для УУ)
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите месяц" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите год" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Excel
            </Button>
            <Button onClick={exportToPDF} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
          {selectedRows.size > 0 && (
            <p className="text-sm text-muted-foreground">
              Выбрано: {selectedRows.size} из {filteredRequests.length}
            </p>
          )}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredRequests.length > 0 && selectedRows.size === filteredRequests.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[50px]">№</TableHead>
                <TableHead>ТМЦ</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>№ Счета</TableHead>
                <TableHead className="text-right">Сумма закупа</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request, index) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(request.id)}
                        onCheckedChange={() => toggleRow(request.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{request.description}</TableCell>
                    <TableCell>{request.contractor || "Не указан"}</TableCell>
                    <TableCell>{request.invoice_number || "Не указан"}</TableCell>
                    <TableCell className="text-right">
                      {request.amount ? `${request.amount.toFixed(2)} ₽` : "0.00 ₽"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-4 flex justify-end">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Общая сумма</p>
            <p className="text-lg font-semibold">
              {requestsToExport
                .reduce((sum, req) => sum + (req.amount || 0), 0)
                .toFixed(2)}{" "}
              ₽
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
