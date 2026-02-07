import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye } from "lucide-react";
import { useDeadstock, DeadstockItem } from "@/hooks/useDeadstock";
import { DeadstockFormDialog } from "@/components/deadstock/DeadstockFormDialog";
import { DeadstockSoldDialog } from "@/components/deadstock/DeadstockSoldDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

export default function DeadstockPage() {
  const [tab, setTab] = useState("active");
  const active = useDeadstock("active");
  const archived = useDeadstock("archived");

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<DeadstockItem | null>(null);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [soldItemId, setSoldItemId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleCreate = () => { setEditItem(null); setFormOpen(true); };
  const handleEdit = (item: DeadstockItem) => { setEditItem(item); setFormOpen(true); };

  const handleSave = async (data: Record<string, unknown>) => {
    if (data.id) {
      const { id, organization_id, ...rest } = data as any;
      await (tab === "active" ? active : archived).updateItem({ id, ...rest });
    } else {
      await active.createItem(data as any);
    }
  };

  const handleSoldClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSoldItemId(id);
    setSoldDialogOpen(true);
  };

  const handleSoldConfirm = async (soldData: { sold_at: string; buyer: string; invoice_number: string; tk?: string; shipped_at?: string; arrived_at?: string }) => {
    if (!soldItemId) return;
    await active.markSold({ id: soldItemId, ...soldData });
    setSoldDialogOpen(false);
    setSoldItemId(null);
  };

  const fmt = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy") : "—";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">База неликвида</h1>
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1" />Создать</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Активные</TabsTrigger>
          <TabsTrigger value="archived">Архив</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : active.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Нет активных позиций</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="w-16">Кол-во</TableHead>
                    <TableHead className={isMobile ? "min-w-[180px]" : "min-w-[250px]"}>Описание</TableHead>
                    <TableHead>Парт номер</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead className="w-24">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.items.map(item => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(item)}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>
                        <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">{item.description || "—"}</p>
                      </TableCell>
                      <TableCell>{item.part_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{Number(item.price).toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={e => handleSoldClick(item.id, e)}>Продано</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {archived.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : archived.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Архив пуст</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата продажи</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="w-16">Кол-во</TableHead>
                    <TableHead>Парт номер</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Покупатель</TableHead>
                    <TableHead>№ счета</TableHead>
                    <TableHead>ТК</TableHead>
                    <TableHead>Отгрузка</TableHead>
                    <TableHead>Приход</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archived.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">{fmt(item.sold_at)}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{item.part_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{Number(item.price).toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell>{item.buyer || "—"}</TableCell>
                      <TableCell>{item.invoice_number || "—"}</TableCell>
                      <TableCell>{item.tk || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(item.shipped_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(item.arrived_at)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DeadstockFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        onSave={handleSave}
        isPending={active.isCreating || active.isUpdating || archived.isUpdating}
      />

      <DeadstockSoldDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        onConfirm={handleSoldConfirm}
        isPending={active.isMarkingSold}
      />
    </div>
  );
}
