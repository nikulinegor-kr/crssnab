import { useState } from "react";
import { useProcurementItems, useProcurements, useDeleteProcurementItem, useAddProcurementItem } from "@/hooks/useProcurements";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, Trash2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcurementExportButton } from "./ProcurementExportButton";
import { useToast } from "@/hooks/use-toast";

interface ProcurementDetailProps {
  procurementId: string;
  onBack: () => void;
}

export const ProcurementDetail = ({ procurementId, onBack }: ProcurementDetailProps) => {
  const { data: procurements } = useProcurements();
  const { data: items, isLoading } = useProcurementItems(procurementId);
  const deleteItem = useDeleteProcurementItem();
  const addItem = useAddProcurementItem();
  const { toast } = useToast();

  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("0");

  const procurement = procurements?.find((p) => p.id === procurementId);
  const totalAmount = items?.reduce((sum, item) => sum + item.total, 0) || 0;

  const handleDelete = (itemId: string) => {
    deleteItem.mutate(
      { itemId, procurementId },
      {
        onSuccess: () => toast({ title: "Позиция удалена" }),
      }
    );
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addItem.mutate(
      {
        procurement_id: procurementId,
        name: newName.trim(),
        qty: parseInt(newQty) || 1,
        price: parseFloat(newPrice) || 0,
      },
      {
        onSuccess: () => {
          toast({ title: "Позиция добавлена" });
          setNewName("");
          setNewQty("1");
          setNewPrice("0");
          setShowAddRow(false);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-lg">{procurement?.name || "Свод"}</h2>
            <p className="text-xs text-muted-foreground">{procurement?.creator_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddRow(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
          {items && items.length > 0 && (
            <ProcurementExportButton
              items={items}
              procurementName={procurement?.name || "Свод"}
              totalAmount={totalAmount}
            />
          )}
        </div>
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
                <TableHead className="w-12" />
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteItem.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {showAddRow && (
                <TableRow>
                  <TableCell className="text-muted-foreground">+</TableCell>
                  <TableCell>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Наименование"
                      className="h-8"
                      autoFocus
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      type="number"
                      className="h-8 w-16 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      type="number"
                      className="h-8 w-24 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {((parseInt(newQty) || 0) * (parseFloat(newPrice) || 0)).toLocaleString("ru-RU")} ₽
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="h-7 w-7" onClick={handleAdd} disabled={addItem.isPending || !newName.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
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
