import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Request } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MeetingReportButtonProps {
  requests: Request[];
  filteredRequests?: Request[];
}

// Roboto cache for cyrillic in PDF
let robotoBase64Cache: string | null = null;
async function loadRobotoBase64(): Promise<string> {
  if (robotoBase64Cache) return robotoBase64Cache;
  const buf = await fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  robotoBase64Cache = btoa(binary);
  return robotoBase64Cache;
}

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = date.getFullYear();
  return `${dd}.${mm}.${yy}`;
};

const formatAmount = (n?: number | null) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

const todayFile = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export function MeetingReportButton({ requests, filteredRequests }: MeetingReportButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const data = filteredRequests || requests;

  const noData = () => {
    toast({
      title: "Нет данных для выгрузки",
      description: "Список заявок пуст",
      variant: "destructive",
    });
  };

  const exportExcel = () => {
    if (!data || data.length === 0) return noData();

    const rows = data.map((r) => ({
      "Заявка": r.description || r.request_number || "—",
      "Статус": r.status || "—",
      "Факт оплаты, %": r.payment_percentage ?? 0,
      "Отгрузка": formatDate(r.shipment_date),
      "Приход": formatDate(r.delivery_date),
      "Сумма": Number(r.amount) || 0,
      "Заявитель": r.applicant || "—",
    }));

    const totalSum = data.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    rows.push({
      "Заявка": `Итого: ${data.length} заявок`,
      "Статус": "",
      "Факт оплаты, %": "" as any,
      "Отгрузка": "",
      "Приход": "",
      "Сумма": totalSum,
      "Заявитель": "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 50 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
    ];

    // Bold header
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[addr]) ws[addr].s = { font: { bold: true } };
    }

    // Number format for Сумма column (col F = index 5)
    for (let R = 1; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: 5 });
      if (ws[addr]) ws[addr].z = "#,##0.00";
    }
    // Bold totals row
    const lastRow = range.e.r;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: lastRow, c: C });
      if (ws[addr]) ws[addr].s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Планерка");
    XLSX.writeFile(wb, `Планерка_Заявки_${todayFile()}.xlsx`);

    toast({
      title: "Отчет сформирован",
      description: `Excel: ${data.length} заявок`,
    });
  };

  const exportPdf = async () => {
    if (!data || data.length === 0) return noData();
    setBusy(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      // Cyrillic font
      try {
        const b64 = await loadRobotoBase64();
        doc.addFileToVFS("Roboto-Regular.ttf", b64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.setFont("Roboto");
      } catch (e) {
        console.warn("Roboto font load failed, falling back", e);
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      doc.setFontSize(14);
      doc.text("Отчет для планерки — Заявки", 40, 40);
      doc.setFontSize(10);
      doc.text(`Сформировано: ${dateStr}`, 40, 58);
      doc.text(`Всего заявок: ${data.length}`, pageWidth - 40, 58, { align: "right" });

      const totalSum = data.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const body = data.map((r) => [
        r.description || r.request_number || "—",
        r.status || "—",
        `${r.payment_percentage ?? 0}%`,
        formatDate(r.shipment_date),
        formatDate(r.delivery_date),
        formatAmount(Number(r.amount)),
        r.applicant || "—",
      ]);

      autoTable(doc, {
        startY: 75,
        head: [["Заявка", "Статус", "Факт оплаты", "Отгрузка", "Приход", "Сумма, ₽", "Заявитель"]],
        body,
        styles: {
          font: "Roboto",
          fontSize: 8,
          cellPadding: 4,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          font: "Roboto",
          fontStyle: "normal",
          fillColor: [31, 41, 55],
          textColor: 255,
          fontSize: 9,
        },
        bodyStyles: { font: "Roboto" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 240 },
          1: { cellWidth: 80 },
          2: { cellWidth: 60, halign: "right" },
          3: { cellWidth: 60, halign: "center" },
          4: { cellWidth: 60, halign: "center" },
          5: { cellWidth: 90, halign: "right" },
          6: { cellWidth: "auto" },
        },
        foot: [[
          `Итого: ${data.length} заявок`,
          "",
          "",
          "",
          "",
          formatAmount(totalSum) + " ₽",
          "",
        ]],
        footStyles: {
          font: "Roboto",
          fillColor: [229, 231, 235],
          textColor: 20,
          fontStyle: "normal",
        },
        margin: { left: 30, right: 30 },
      });

      doc.save(`Планерка_Заявки_${todayFile()}.pdf`);

      toast({
        title: "Отчет сформирован",
        description: `PDF: ${data.length} заявок`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Ошибка формирования PDF",
        description: e?.message || "Попробуйте еще раз",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={busy}>
          <FileDown className="h-4 w-4" />
          Выгрузить отчет
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-rose-600" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
