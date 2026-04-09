import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TableRow {
  id?: string;
  row_number: number;
  tmc: string;
  contractor: string;
  invoice_number: string;
  amount: number;
  formula?: string;
  _adjusted?: boolean;
}

interface ReportTableProps {
  rows: TableRow[];
  onChange: (rows: TableRow[]) => void;
  contractNumber?: string;
  contractDate?: string;
  selectedMonth?: number;
  selectedYear?: number;
  months?: { value: number; label: string }[];
  commissionPercent?: number;
  readOnly?: boolean;
}

export const ReportTable = ({ rows, onChange, contractNumber, contractDate, selectedMonth, selectedYear, months, commissionPercent, readOnly }: ReportTableProps) => {
  const updateCell = (rowNumber: number, field: keyof TableRow, value: any) => {
    if (readOnly) return;
    const updatedRows = rows.map(r => {
      if (r.row_number === rowNumber) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onChange(updatedRows);
  };

  const addRow = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (commissionPercent !== undefined) {
      return total * (commissionPercent / 100);
    }
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
              {!readOnly && <th className="border border-border p-2 text-center font-semibold w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_number} className="bg-background">
                <td className="border border-border p-2 text-center">{row.row_number}</td>
                <td className="border border-border p-1">
                  {readOnly ? (
                    <div className="px-2 py-1 min-w-[200px] text-sm">{row.tmc}</div>
                  ) : (
                    <Textarea
                      value={row.tmc}
                      onChange={(e) => updateCell(row.row_number, "tmc", e.target.value)}
                      className="min-w-[200px] min-h-[40px] bg-transparent border-none resize-none"
                    />
                  )}
                </td>
                <td className="border border-border p-1">
                  {readOnly ? (
                    <div className="px-2 py-1 min-w-[150px] text-sm">{row.contractor}</div>
                  ) : (
                    <Input
                      value={row.contractor}
                      onChange={(e) => updateCell(row.row_number, "contractor", e.target.value)}
                      className="min-w-[150px] bg-transparent border-none"
                    />
                  )}
                </td>
                <td className="border border-border p-1">
                  {readOnly ? (
                    <div className="px-2 py-1 min-w-[100px] text-sm">{row.invoice_number}</div>
                  ) : (
                    <Input
                      value={row.invoice_number}
                      onChange={(e) => updateCell(row.row_number, "invoice_number", e.target.value)}
                      className="min-w-[100px] bg-transparent border-none"
                    />
                  )}
                </td>
                <td className="border border-border p-1">
                  <div className="flex flex-col items-end gap-1">
                    {readOnly ? (
                      <div className="px-2 py-1 text-right text-sm font-medium">
                        {typeof row.amount === 'number' ? row.amount.toFixed(2) : row.amount}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateCell(row.row_number, "amount", parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-none text-right"
                        placeholder="0"
                      />
                    )}
                    {row._adjusted && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-primary/30">
                        Скорректировано
                      </Badge>
                    )}
                  </div>
                </td>
                {!readOnly && (
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
                )}
              </tr>
            ))}
            <tr className="bg-muted">
              <td colSpan={readOnly ? 4 : 4} className="border border-border p-2 text-left font-bold">ИТОГО:</td>
              <td className="border border-border p-2 text-right font-bold">{calculateTotal().toFixed(2)}</td>
              {!readOnly && <td className="border border-border p-2"></td>}
            </tr>
            <tr className="bg-muted">
              <td colSpan={readOnly ? 4 : 4} className="border border-border p-2 text-left font-bold">
                Сумма вознаграждения согласно п. 4.2. агентского договора № {contractNumber || '1-21'} от {contractDate || '2021-05-28'} г. за {months?.find(m => m.value === selectedMonth)?.label || 'месяц'} {selectedYear || '2025'} г.:
              </td>
              <td className="border border-border p-2 text-right font-bold">{calculateCommission().toFixed(2)}</td>
              {!readOnly && <td className="border border-border p-2"></td>}
            </tr>
          </tbody>
        </table>
      </div>
      
      {!readOnly && (
        <Button onClick={addRow} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Добавить строку
        </Button>
      )}
    </div>
  );
};
