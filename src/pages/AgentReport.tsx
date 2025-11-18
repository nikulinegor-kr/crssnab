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

export default function AgentReport() {
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

  const exportToExcel = async () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label || "";
    
    // Определяем первый и последний день выбранного месяца
    const firstDay = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
    const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };
    
    try {
      // Загружаем шаблон
      const response = await fetch('/templates/agent-report-template.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Работаем со второй страницей (лист "Отчет агента")
      const ws = wb.Sheets[wb.SheetNames[1]];
      
      // Заменяем "октябрь" на выбранный месяц во всех ячейках
      const sheetRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = sheetRange.s.r; row <= sheetRange.e.r; row++) {
        for (let col = sheetRange.s.c; col <= sheetRange.e.c; col++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = ws[cellAddr];
          if (cell && cell.t === 's' && typeof cell.v === 'string') {
            const lowerValue = cell.v.toLowerCase();
            if (lowerValue.includes('октябрь') || lowerValue.includes('октября')) {
              cell.v = cell.v.replace(/октябрь/gi, monthName.toLowerCase());
              cell.v = cell.v.replace(/октября/gi, monthName.toLowerCase().replace('ь', 'я'));
            }
          }
        }
      }
      
      // Обновляем период в ячейке A14
      ws['A14'] = { 
        t: 's', 
        v: `За период с ${formatDate(firstDay)} г. по ${formatDate(lastDay)} г. произведен закуп ТМЦ:` 
      };
      
      // Удаляем старые данные (строки с 17 по последнюю перед подписями)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = 16; row < range.e.r - 5; row++) {
        for (let col = 0; col <= 4; col++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          delete ws[cellAddr];
        }
      }
      
      // Добавляем новые данные начиная с A17
      requestsToExport.forEach((req, index) => {
        const rowNum = 16 + index;
        ws[XLSX.utils.encode_cell({ r: rowNum, c: 0 })] = { t: 'n', v: index + 1 };
        ws[XLSX.utils.encode_cell({ r: rowNum, c: 1 })] = { t: 's', v: req.description };
        ws[XLSX.utils.encode_cell({ r: rowNum, c: 2 })] = { t: 's', v: req.contractor || "Не указан" };
        ws[XLSX.utils.encode_cell({ r: rowNum, c: 3 })] = { t: 's', v: req.invoice_number || "Не указан" };
        ws[XLSX.utils.encode_cell({ r: rowNum, c: 4 })] = { t: 'n', v: req.amount || 0, z: '#,##0.00' };
      });
      
      // Обновляем диапазон листа
      const newRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      newRange.e.r = 16 + requestsToExport.length + 5;
      ws['!ref'] = XLSX.utils.encode_range(newRange);
      
      XLSX.writeFile(wb, `Отчет_агента_${monthName}_${selectedYear}.xlsx`);
    } catch (error) {
      console.error("Ошибка при экспорте:", error);
    }
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
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Отчет агента</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Отчет по закупкам ТМЦ за выбранный период
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
