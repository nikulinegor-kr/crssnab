import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye } from "lucide-react";
import { useDeadstock, DeadstockItem } from "@/hooks/useDeadstock";
import { DeadstockFormDialog } from "@/components/deadstock/DeadstockFormDialog";
import { DeadstockSoldDialog } from "@/components/deadstock/DeadstockSoldDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizableTableHeader } from "@/components/requests/ResizableTableHeader";
import { useDeadstockActiveWidths, useDeadstockArchiveWidths } from "@/hooks/useDeadstockColumnWidths";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

function useOrgProfiles(orgId: string | null) {
  return useQuery({
    queryKey: ["org-profiles", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", orgId);
      if (!data?.length) return [];
      const ids = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return profiles ?? [];
    },
    enabled: !!orgId,
  });
}

export default function DeadstockPage() {
  const [tab, setTab] = useState("active");
  const active = useDeadstock("active");
  const archived = useDeadstock("archived");
  const { currentOrgId } = useCurrentOrganization();
  const { data: profiles = [] } = useOrgProfiles(currentOrgId);

  const activeWidths = useDeadstockActiveWidths();
  const archiveWidths = useDeadstockArchiveWidths();

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

  const getResponsibleName = (userId: string | null) => {
    if (!userId) return "—";
    const p = profiles.find(pr => pr.id === userId);
    return p?.full_name || p?.email || "—";
  };

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
                  <tr>
                    <ResizableTableHeader column="name" label="Наименование" width={activeWidths.widths.name} onResize={activeWidths.updateWidth} align="left" />
                    <ResizableTableHeader column="qty" label="Кол-во" width={activeWidths.widths.qty} onResize={activeWidths.updateWidth} />
                    <ResizableTableHeader column="description" label="Описание" width={activeWidths.widths.description} onResize={activeWidths.updateWidth} />
                    <ResizableTableHeader column="part_number" label="Парт номер" width={activeWidths.widths.part_number} onResize={activeWidths.updateWidth} />
                    <ResizableTableHeader column="price" label="Цена" width={activeWidths.widths.price} onResize={activeWidths.updateWidth} />
                    <ResizableTableHeader column="responsible" label="Ответственный" width={activeWidths.widths.responsible} onResize={activeWidths.updateWidth} />
                    <ResizableTableHeader column="action" label="Действие" width={activeWidths.widths.action} onResize={activeWidths.updateWidth} />
                  </tr>
                </TableHeader>
                <TableBody>
                  {active.items.map(item => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(item)}>
                      <TableCell className="font-medium text-left border-r border-border/40" style={{ width: activeWidths.widths.name }}>{item.name}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: activeWidths.widths.qty }}>{item.qty}</TableCell>
                      <TableCell className="border-r border-border/40" style={{ width: activeWidths.widths.description }}>
                        <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap text-center">{item.description || "—"}</p>
                      </TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: activeWidths.widths.part_number }}>{item.part_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center border-r border-border/40" style={{ width: activeWidths.widths.price }}>{Number(item.price).toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: activeWidths.widths.responsible }}>{getResponsibleName(item.responsible_user_id)}</TableCell>
                      <TableCell className="text-center" style={{ width: activeWidths.widths.action }}>
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
                  <tr>
                    <ResizableTableHeader column="sold_at" label="Дата продажи" width={archiveWidths.widths.sold_at} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="name" label="Наименование" width={archiveWidths.widths.name} onResize={archiveWidths.updateWidth} align="left" />
                    <ResizableTableHeader column="qty" label="Кол-во" width={archiveWidths.widths.qty} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="part_number" label="Парт номер" width={archiveWidths.widths.part_number} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="price" label="Цена" width={archiveWidths.widths.price} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="buyer" label="Покупатель" width={archiveWidths.widths.buyer} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="invoice_number" label="№ счета" width={archiveWidths.widths.invoice_number} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="tk" label="ТК" width={archiveWidths.widths.tk} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="shipped_at" label="Отгрузка" width={archiveWidths.widths.shipped_at} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="arrived_at" label="Приход" width={archiveWidths.widths.arrived_at} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="responsible" label="Ответственный" width={archiveWidths.widths.responsible} onResize={archiveWidths.updateWidth} />
                    <ResizableTableHeader column="action" label="" width={archiveWidths.widths.action} onResize={archiveWidths.updateWidth} />
                  </tr>
                </TableHeader>
                <TableBody>
                  {archived.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-center border-r border-border/40" style={{ width: archiveWidths.widths.sold_at }}>{fmt(item.sold_at)}</TableCell>
                      <TableCell className="font-medium text-left border-r border-border/40" style={{ width: archiveWidths.widths.name }}>{item.name}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.qty }}>{item.qty}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.part_number }}>{item.part_number || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center border-r border-border/40" style={{ width: archiveWidths.widths.price }}>{Number(item.price).toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.buyer }}>{item.buyer || "—"}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.invoice_number }}>{item.invoice_number || "—"}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.tk }}>{item.tk || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center border-r border-border/40" style={{ width: archiveWidths.widths.shipped_at }}>{fmt(item.shipped_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-center border-r border-border/40" style={{ width: archiveWidths.widths.arrived_at }}>{fmt(item.arrived_at)}</TableCell>
                      <TableCell className="text-center border-r border-border/40" style={{ width: archiveWidths.widths.responsible }}>{getResponsibleName(item.responsible_user_id)}</TableCell>
                      <TableCell className="text-center" style={{ width: archiveWidths.widths.action }}>
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
        profiles={profiles}
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
