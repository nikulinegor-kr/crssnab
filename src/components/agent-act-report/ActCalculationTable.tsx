import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

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
  amount: number | null;
}

interface ActCalculationTableProps {
  rows: CalculationRow[];
  onUpdate: (id: string, field: keyof CalculationRow, value: any) => void;
  onDelete: (id: string) => void;
  agentCommission?: number;
  additionalRows?: AdditionalRow[];
}

export const ActCalculationTable = ({ rows, onUpdate, onDelete, agentCommission = 0, additionalRows = [] }: ActCalculationTableProps) => {
  const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

  const calculateTotals = () => {
    if (rows.length === 0) {
      const salaryTotal = 30000 + agentCommission;
      const remainder = salaryTotal + checkAmountTotal;
      const actAmount = (remainder / 93) * 100;
      const tax = actAmount * 0.07;
      return {
        tax_7_percent: tax,
        remainder_after_tax: remainder,
        salary_with_commission: salaryTotal,
        check_amount: checkAmountTotal,
        act_amount: actAmount,
      };
    }

    return {
      tax_7_percent: rows.reduce((sum, row) => sum + (row.tax_7_percent || 0), 0),
      remainder_after_tax: rows.reduce((sum, row) => sum + (row.remainder_after_tax || 0), 0),
      salary_with_commission: rows.reduce((sum, row) => {
        const value = row.salary_with_commission !== null && row.salary_with_commission !== 0
          ? row.salary_with_commission
          : 30000 + agentCommission;
        return sum + value;
      }, 0),
      check_amount: checkAmountTotal,
      act_amount: rows.reduce((sum, row) => sum + (row.act_amount || 0), 0),
    };
  };

  const totals = calculateTotals();

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="text-center">Дата перечисления</TableHead>
            <TableHead className="text-center">Перечислено на р/счет, касса в том числе вознаграждение</TableHead>
            <TableHead className="text-center">Налог 7%</TableHead>
            <TableHead className="text-center">Остаток после удержания налога 7%</TableHead>
            <TableHead className="text-center bg-green-100 dark:bg-green-900/30">Заработная плата 30 000 +% вознаграждение агента</TableHead>
            <TableHead className="text-center">Сумма по чекам</TableHead>
            <TableHead className="text-center">Сумма Акта</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const salary = row.salary_with_commission !== null && row.salary_with_commission !== 0
              ? row.salary_with_commission
              : 30000 + agentCommission;

            return (
              <>
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      type="date"
                      value={row.transfer_date || ""}
                      onChange={(e) => onUpdate(row.id, "transfer_date", e.target.value || null)}
                      className="text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={row.transferred_amount || ""}
                      onChange={(e) => onUpdate(row.id, "transferred_amount", parseFloat(e.target.value) || null)}
                      className="text-right"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="text-right bg-muted/30">
                    {row.tax_7_percent !== null ? row.tax_7_percent.toFixed(2) : ""}
                  </TableCell>
                  <TableCell className="text-right bg-muted/30 font-semibold">
                    {row.remainder_after_tax !== null ? row.remainder_after_tax.toFixed(2) : ""}
                  </TableCell>
                  <TableCell className="text-right bg-green-50 dark:bg-green-900/20 font-semibold">
                    {(30000).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {checkAmountTotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.act_amount !== null ? row.act_amount.toFixed(2) : ""}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(row.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {agentCommission > 0 && (
                  <TableRow key={`${row.id}-commission`} className="border-t-0">
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right bg-muted/30">
                      {agentCommission.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          <TableRow className="font-bold bg-muted/50">
            <TableCell className="text-left">ИТОГО:</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right">{totals.tax_7_percent.toFixed(2)}</TableCell>
            <TableCell className="text-right">{totals.remainder_after_tax.toFixed(2)}</TableCell>
            <TableCell className="text-right bg-green-50 dark:bg-green-900/20">{totals.salary_with_commission.toFixed(2)}</TableCell>
            <TableCell className="text-right">{totals.check_amount.toFixed(2)}</TableCell>
            <TableCell className="text-right">{totals.act_amount.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};