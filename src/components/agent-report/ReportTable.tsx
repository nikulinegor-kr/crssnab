import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

interface TableRow {
  id?: string;
  row_number: number;
  tmc: string;
  contractor: string;
  invoice_number: string;
  amount: number;
  formula?: string;
}

interface ReportTableProps {
  rows: TableRow[];
  onChange: (rows: TableRow[]) => void;
  contractNumber?: string;
  contractDate?: string;
  selectedMonth?: number;
  selectedYear?: number;
  months?: { value: number; label: string }[];
}

export const ReportTable = ({ rows, onChange, contractNumber, contractDate, selectedMonth, selectedYear, months }: ReportTableProps) => {
  const updateCell = (rowNumber: number, field: keyof TableRow, value: any) => {
    const updatedRows = rows.map(r => {
      if (r.row_number === rowNumber) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onChange(updatedRows);
  };

  const addRow = () => {
    const newRowNumber = rows.length + 1;
    onChange([...rows, {
      row_number: newRowNumber,
      tmc: "",
      contractor: "",
      invoice_number: "",
      amount: 0
    }]);
  };

  const deleteRow = (rowNumber: number) => {
    onChange(rows.filter(r => r.row_number !== rowNumber).map((r, i) => ({ ...r, row_number: i + 1 })));
  };

  const calculateTotal = () => {
    return rows.reduce((sum, row) => {
      const amount = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount)) || 0;
      return sum + amount;
    }, 0);
  };

  const calculateCommission = () => {
    const total = calculateTotal();
    if (total >= 10000000) {
      return 5000000 * 0.02 + 5000000 * 0.01 + (total - 10000000) * 0.005;
    } else if (total >= 5000000) {
      return 5000000 * 0.02 + (total - 5000000) * 0.01;
    } else {
      return total * 0.02;
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-center font-semibold w-16">№</th>
              <th className="border border-border p-2 text-center font-semibold">ТМЦ</th>
              <th className="border border-border p-2 text-center font-semibold">Контрагент</th>
              <th className="border border-border p-2 text-center font-semibold">№ Счета</th>
              <th className="border border-border p-2 text-center font-semibold w-40">Сумма закупа</th>
              <th className="border border-border p-2 text-center font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.row_number} className="bg-background">
                <td className="border border-border p-2 text-center">{row.row_number}</td>
                <td className="border border-border p-1">
                  <Textarea
                    value={row.tmc}
                    onChange={(e) => updateCell(row.row_number, "tmc", e.target.value)}
                    className="min-w-[200px] min-h-[40px] bg-transparent border-none resize-none"
                  />
                </td>
                <td className="border border-border p-1">
                  <Input
                    value={row.contractor}
                    onChange={(e) => updateCell(row.row_number, "contractor", e.target.value)}
                    className="min-w-[150px] bg-transparent border-none"
                  />
                </td>
                <td className="border border-border p-1">
                  <Input
                    value={row.invoice_number}
                    onChange={(e) => updateCell(row.row_number, "invoice_number", e.target.value)}
                    className="min-w-[100px] bg-transparent border-none"
                  />
                </td>
                <td className="border border-border p-1">
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={(e) => updateCell(row.row_number, "amount", parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent border-none text-right"
                    placeholder="0"
                  />
                </td>
                <td className="border border-border p-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(row.row_number)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="bg-muted font-bold">
              <td colSpan={4} className="border border-border p-2 text-right">ИТОГО:</td>
              <td className="border border-border p-2 text-right">{calculateTotal().toFixed(2)}</td>
              <td className="border border-border p-2"></td>
            </tr>
            <tr className="bg-muted font-bold">
              <td colSpan={4} className="border border-border p-2 text-left">
                Сумма вознаграждения согласно п. 4.2. агентского договора № {contractNumber || '1-21'} от {contractDate || '2021-05-28'} г. за {months?.find(m => m.value === selectedMonth)?.label || 'месяц'} {selectedYear || '2025'} г.:
              </td>
              <td className="border border-border p-2 text-right">{calculateCommission().toFixed(2)}</td>
              <td className="border border-border p-2"></td>
            </tr>
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
