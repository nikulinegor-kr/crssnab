import { useState } from "react";
import { useProcurementItems, useProcurements, useDeleteProcurementItem, useAddProcurementItem } from "@/hooks/useProcurements";
import { useRequests } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, AlertTriangle, Trash2, Plus, Search, ListPlus, PenLine } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ProcurementExportButton } from "./ProcurementExportButton";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProcurementDetailProps {
  procurementId: string;
  onBack: () => void;
}

export const ProcurementDetail = ({ procurementId, onBack }: ProcurementDetailProps) => {
  const { data: procurements } = useProcurements();
  const { data: items, isLoading } = useProcurementItems(procurementId);
  const { data: allRequests } = useRequests(false);
  const deleteItem = useDeleteProcurementItem();
  const addItem = useAddProcurementItem();
  const { toast } = useToast();

  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");

  const [showRequestPicker, setShowRequestPicker] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());

  const procurement = procurements?.find((p) => p.id === procurementId);
  const totalAmount = items?.reduce((sum, item) => sum + item.total, 0) || 0;

  // Filter out requests already in this procurement
  const existingRequestIds = new Set(items?.map((i) => i.request_id) || []);
  const availableRequests = allRequests?.filter((r) => {
    if (existingRequestIds.has(r.id)) return false;
    if (!requestSearch.trim()) return true;
    const q = requestSearch.toLowerCase();
    return (
      r.description?.toLowerCase().includes(q) ||
      r.request_number?.toLowerCase().includes(q) ||
      r.contractor?.toLowerCase().includes(q)
    );
  });

  const handleDelete = (itemId: string) => {
    deleteItem.mutate(
      { itemId, procurementId },
      { onSuccess: () => toast({ title: "Позиция удалена" }) }
    );
  };

  const handleAddManual = () => {
    if (!newName.trim()) return;
    addItem.mutate(
      {
        procurement_id: procurementId,
        name: newName.trim(),
        qty: parseInt(newQty) || 1,
        price: 0,
      },
      {
        onSuccess: () => {
          toast({ title: "Позиция добавлена" });
          setNewName("");
          setNewQty("1");
          setShowAddRow(false);
        },
      }
    );
  };

  const toggleRequestSelection = (id: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddFromRequests = () => {
    if (selectedRequestIds.size === 0) return;
    const selected = allRequests?.filter((r) => selectedRequestIds.has(r.id)) || [];

    Promise.all(
      selected.map((r) =>
        addItem.mutateAsync({
          procurement_id: procurementId,
          name: r.description,
          qty: 1,
          price: r.amount || 0,
        })
      )
    ).then(() => {
      toast({ title: `Добавлено ${selected.length} позиций` });
      setSelectedRequestIds(new Set());
      setShowRequestPicker(false);
      setRequestSearch("");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-lg">{procurement?.name || "Стоимость закупок"}</h2>
            <p className="text-xs text-muted-foreground">{procurement?.creator_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRequestPicker(true)} className="gap-1.5">
            <ListPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Из заявок</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddRow(true)} className="gap-1.5">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Вручную</span>
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
                <TableHead className="w-32 text-right">Сумма</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={item.total === 0 ? "text-amber-500 flex items-center justify-end gap-1" : ""}>
                      {item.total === 0 && <AlertTriangle className="h-3 w-3" />}
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
                      onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
                    />
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Button size="icon" className="h-7 w-7" onClick={handleAddManual} disabled={addItem.isPending || !newName.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Request picker dialog */}
      <Dialog open={showRequestPicker} onOpenChange={setShowRequestPicker}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Добавить из заявок</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder="Поиск по номеру или описанию..."
              className="pl-9"
            />
          </div>
          <ScrollArea className="flex-1 max-h-[50vh] -mx-6 px-6">
            <div className="space-y-1">
              {availableRequests?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Нет доступных заявок</p>
              )}
              {availableRequests?.map((r) => (
                <label
                  key={r.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedRequestIds.has(r.id)}
                    onCheckedChange={() => toggleRequestSelection(r.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{r.request_number}</span>
                      {r.amount > 0 && (
                        <span className="text-xs text-muted-foreground">{r.amount.toLocaleString("ru-RU")} ₽</span>
                      )}
                    </div>
                    <p className="text-sm truncate">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              Выбрано: {selectedRequestIds.size}
            </span>
            <Button onClick={handleAddFromRequests} disabled={selectedRequestIds.size === 0 || addItem.isPending}>
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
