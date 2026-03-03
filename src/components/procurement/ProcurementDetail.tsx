import { useProcurementItems, useProcurements } from "@/hooks/useProcurements";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcurementExportButton } from "./ProcurementExportButton";

interface ProcurementDetailProps {
  procurementId: string;
  onBack: () => void;
}

export const ProcurementDetail = ({ procurementId, onBack }: ProcurementDetailProps) => {
  const { data: procurements } = useProcurements();
  const { data: items, isLoading } = useProcurementItems(procurementId);

  const procurement = procurements?.find((p) => p.id === procurementId);
  const totalAmount = items?.reduce((sum, item) => sum + item.total, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-lg">{procurement?.name || "Закуп"}</h2>
            <p className="text-xs text-muted-foreground">{procurement?.creator_name}</p>
          </div>
        </div>
        {items && items.length > 0 && (
          <ProcurementExportButton
            items={items}
            procurementName={procurement?.name || "Закуп"}
            totalAmount={totalAmount}
          />
        )}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead className="w-20 text-right">Кол-во</TableHead>
                <TableHead className="w-28 text-right">Цена</TableHead>
                <TableHead className="w-32 text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">
                    <span className={item.price === 0 ? "text-amber-500 flex items-center justify-end gap-1" : ""}>
                      {item.price === 0 && <AlertTriangle className="h-3 w-3" />}
                      {item.price.toLocaleString("ru-RU")} ₽
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={item.total === 0 ? "text-amber-500" : ""}>
                      {item.total.toLocaleString("ru-RU")} ₽
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="border-t p-4 flex justify-end">
          <div className="text-right">
            <span className="text-sm text-muted-foreground mr-3">ИТОГО:</span>
            <span className="text-xl font-bold">{totalAmount.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
