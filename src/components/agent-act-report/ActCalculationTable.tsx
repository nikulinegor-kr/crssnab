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

interface ActCalculationTableProps {
  rows: CalculationRow[];
  onUpdate: (id: string, field: keyof CalculationRow, value: any) => void;
  onDelete: (id: string) => void;
  agentCommission?: number;
}

export const ActCalculationTable = ({ rows, onUpdate, onDelete, agentCommission = 0 }: ActCalculationTableProps) => {
  const handleTransferredAmountChange = (id: string, value: number | null) => {
    onUpdate(id, "transferred_amount", value);
    
    // Автоматически рассчитываем налог 7%
    if (value !== null) {
      const tax = value * 0.07;
      onUpdate(id, "tax_7_percent", parseFloat(tax.toFixed(2)));
      
      // Автоматически рассчитываем остаток после налога
      const remainder = value - tax;
      onUpdate(id, "remainder_after_tax", parseFloat(remainder.toFixed(2)));
      
      // Автоматически рассчитываем сумму акта = remainder / 93 * 100
      const actAmount = (remainder / 93) * 100;
      onUpdate(id, "act_amount", parseFloat(actAmount.toFixed(2)));
      
      // Автоматически устанавливаем зарплату с комиссией
      onUpdate(id, "salary_with_commission", 30000 + agentCommission);
    }
  };

  const handleRemainderChange = (id: string, value: number | null) => {
    onUpdate(id, "remainder_after_tax", value);
    
    // Автоматически рассчитываем сумму акта = remainder / 93 * 100
    if (value !== null) {
      const actAmount = (value / 93) * 100;
      onUpdate(id, "act_amount", parseFloat(actAmount.toFixed(2)));
    }
  };

  const calculateTotals = () => {
    return {
      transferred_amount: rows.reduce((sum, row) => sum + (row.transferred_amount || 0), 0),
      tax_7_percent: rows.reduce((sum, row) => sum + (row.tax_7_percent || 0), 0),
      remainder_after_tax: rows.reduce((sum, row) => sum + (row.remainder_after_tax || 0), 0),
      salary_with_commission: rows.reduce((sum, row) => {
        // Используем значение по умолчанию, если поле пустое или 0
        const value = (row.salary_with_commission !== null && row.salary_with_commission !== 0) 
          ? row.salary_with_commission 
          : (30000 + agentCommission);
        return sum + value;
      }, 0),
      check_amount: rows.reduce((sum, row) => sum + (row.check_amount || 0), 0),
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
            <TableHead className="text-center">Перечислено на р/счет, касса в том числе вознаграждение</TableHead>
            <TableHead className="text-center">Налог 7%</TableHead>
            <TableHead className="text-center">Остаток после удержания налога 7%</TableHead>
            <TableHead className="text-center">Заработная плата 30 000 +% вознаграждение агента</TableHead>
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
                  value={row.transferred_amount || ""}
                  onChange={(e) => handleTransferredAmountChange(row.id, parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.tax_7_percent || ""}
                  onChange={(e) => onUpdate(row.id, "tax_7_percent", parseFloat(e.target.value) || null)}
                  className="text-center bg-muted/50"
                  step="0.01"
                  disabled
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.remainder_after_tax || ""}
                  onChange={(e) => handleRemainderChange(row.id, parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
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
                  value={row.check_amount || ""}
                  onChange={(e) => onUpdate(row.id, "check_amount", parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.act_amount || ""}
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
            <TableCell className="text-center">{totals.transferred_amount.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.tax_7_percent.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.remainder_after_tax.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.salary_with_commission.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.check_amount.toFixed(2)}</TableCell>
            <TableCell className="text-center">{totals.act_amount.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
