import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Request } from "@/hooks/useRequests";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AgentReport() {
  const { currentOrgId } = useCurrentOrganization();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("request_date", { ascending: false });

      if (error) throw error;
      return data as Request[];
    },
    enabled: !!currentOrgId,
  });

  // Filter requests by selected month/year
  const filteredRequests = requests?.filter((request) => {
    const requestDate = new Date(request.request_date);
    return (
      requestDate.getFullYear().toString() === selectedYear &&
      (requestDate.getMonth() + 1).toString() === selectedMonth
    );
  }) || [];

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

  const exportToExcel = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    const exportData = filteredRequests.map((req, index) => ({
      "№": index + 1,
      "ТМЦ": req.description,
      "Контрагент": req.contractor || "Не указан",
      "№ Счета": req.invoice_number || "Не указан",
      "Сумма закупа": req.amount.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Отчет");
    XLSX.writeFile(wb, `Отчет_агента_${monthName}_${selectedYear}.xlsx`);
  };

  const exportToPDF = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text("Отчет агента", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`За период: ${monthName} ${selectedYear}`, 105, 30, { align: "center" });

    // Prepare table data
    const tableData = filteredRequests.map((req, index) => [
      (index + 1).toString(),
      req.description,
      req.contractor || "Не указан",
      req.invoice_number || "Не указан",
      req.amount.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["№", "ТМЦ", "Контрагент", "№ Счета", "Сумма закупа"]],
      body: tableData,
      styles: { font: "helvetica", fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Отчет_агента_${monthName}_${selectedYear}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Отчет агента</h1>
        <p className="text-sm text-muted-foreground">
          Отчет по закупкам ТМЦ за выбранный период
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request, index) => (
                  <TableRow key={request.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{request.description}</TableCell>
                    <TableCell>{request.contractor || "Не указан"}</TableCell>
                    <TableCell>{request.invoice_number || "Не указан"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {request.amount.toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} ₽
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredRequests.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="text-lg font-semibold">
              Итого: {filteredRequests.reduce((sum, req) => sum + req.amount, 0).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ₽
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
