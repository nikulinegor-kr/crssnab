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
  // Сумма по чекам берется из ИТОГО дополнительных позиций
  const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

  const calculateTotals = () => {
    // Сумма по чекам берется из ИТОГО дополнительных позиций
    const checkAmountTotal = additionalRows.reduce((sum, row) => sum + (row.amount || 0), 0);

    // Если строк нет, сразу показываем базовую зарплату + процент вознаграждения
    if (rows.length === 0) {
      const baseSalary = 30000 + agentCommission;
      return {
        tax_7_percent: baseSalary * 0.07,
        remainder_after_tax: 0,
        salary_with_commission: baseSalary,
        check_amount: checkAmountTotal,
        act_amount: 0,
      };
    }

    return {
      tax_7_percent: rows.reduce((sum, row) => sum + (row.tax_7_percent || 0), 0),
      remainder_after_tax: rows.reduce((sum, row) => sum + (row.remainder_after_tax || 0), 0),
      salary_with_commission: rows.reduce((sum, row) => {
        const value =
          row.salary_with_commission !== null && row.salary_with_commission !== 0
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
            <TableHead className="text-center w-[150px]">Дата перечисления</TableHead>
            <TableHead className="text-center">Заработная плата 30 000 +% вознаграждение агента</TableHead>
            <TableHead className="text-center">Налог 7%</TableHead>
            <TableHead className="text-center">Остаток после удержания налога 7%</TableHead>
            <TableHead className="text-center">Сумма по чекам</TableHead>
            <TableHead className="text-center">Сумма Акта</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Input
                  type="text"
                  value={row.transfer_date || ""}
                  onChange={(e) => onUpdate(row.id, "transfer_date", e.target.value)}
                  className="text-center"
                  placeholder="ДД.ММ.ГГГГ"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.salary_with_commission !== null && row.salary_with_commission !== 0 ? row.salary_with_commission : (30000 + (agentCommission || 0))}
                  onChange={(e) => onUpdate(row.id, "salary_with_commission", parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.tax_7_percent !== null && row.tax_7_percent !== undefined ? row.tax_7_percent : ""}
                  onChange={(e) => onUpdate(row.id, "tax_7_percent", parseFloat(e.target.value) || null)}
                  className="text-center bg-muted/50"
                  step="0.01"
                  disabled
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.remainder_after_tax !== null && row.remainder_after_tax !== undefined ? row.remainder_after_tax : ""}
                  onChange={(e) => onUpdate(row.id, "remainder_after_tax", parseFloat(e.target.value) || null)}
                  className="text-center bg-muted/50"
                  step="0.01"
                  disabled
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.check_amount || ""}
                  onChange={(e) => onUpdate(row.id, "check_amount", parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.act_amount !== null && row.act_amount !== undefined ? row.act_amount : ""}
                  onChange={(e) => onUpdate(row.id, "act_amount", parseFloat(e.target.value) || null)}
                  className="text-center bg-muted/50"
                  step="0.01"
                  disabled
                />
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
          ))}
          <TableRow className="font-bold bg-muted/50">
            <TableCell className="text-center">ИТОГО:</TableCell>
            <TableCell className="text-center">{totals.salary_with_commission.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.tax_7_percent.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.remainder_after_tax.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.check_amount.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.act_amount.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
