import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface AdditionalRow {
  id: string;
  row_number: number;
  description: string | null;
  amount: number | null;
}

interface ActAdditionalTableProps {
  rows: AdditionalRow[];
  onUpdate: (id: string, field: keyof AdditionalRow, value: any) => void;
  onDelete: (id: string) => void;
}

export const ActAdditionalTable = ({ rows, onUpdate, onDelete }: ActAdditionalTableProps) => {
  const calculateTotal = () => {
    return rows.reduce((sum, row) => sum + (row.amount || 0), 0);
  };

  const total = calculateTotal();

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="text-center w-[100px]">№</TableHead>
            <TableHead className="text-center">Описание</TableHead>
            <TableHead className="text-center w-[200px]">Сумма</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell className="text-center">{index + 1}</TableCell>
              <TableCell>
                <Input
                  type="text"
                  value={row.description || ""}
                  onChange={(e) => onUpdate(row.id, "description", e.target.value)}
                  className="text-center"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.amount || ""}
                  onChange={(e) => onUpdate(row.id, "amount", parseFloat(e.target.value) || null)}
                  className="text-center"
                  step="0.01"
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
            <TableCell></TableCell>
            <TableCell className="text-center">{total.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
