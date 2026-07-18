import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ArrowDownToLine, ArrowUpFromLine, RussianRuble, Wrench, Pencil, Archive } from "lucide-react";
import { useSparePartMovements, useSparePartEquipment, type SparePartRow } from "@/hooks/useSpareParts";
import { SparePartMovementDialog } from "./SparePartMovementDialog";
import { SparePartFormDialog } from "./SparePartFormDialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: SparePartRow;
  orgId: string;
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  IN: { label: "Приход", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  WRITE_OFF: { label: "Списание", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  SALE: { label: "Продажа", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  MOVE: { label: "Перемещение", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  RETURN: { label: "Возврат", color: "bg-teal-500/10 text-teal-700 dark:text-teal-400" },
  ADJUST: { label: "Корректировка", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
};

export function SparePartDetailDialog({ open, onOpenChange, part, orgId }: Props) {
  const qc = useQueryClient();
  const { data: movements = [] } = useSparePartMovements(open ? part.id : null);
  const { data: compat = [] } = useSparePartEquipment(open ? part.id : null);

  const [movDialog, setMovDialog] = useState<null | "IN" | "WRITE_OFF" | "SALE" | "ADJUST">(null);
  const [editOpen, setEditOpen] = useState(false);

  const moveToDeadstock = async () => {
    const qty = Math.max(0, part.stock ?? 0);
    if (qty <= 0) { toast.error("Нет остатка для перемещения в неликвид"); return; }
    const reason = prompt("Причина перевода в неликвид?", "Неликвид") || null;
    const { error } = await (supabase as any).from("spare_part_deadstock").insert({
      organization_id: orgId,
      name: part.name,
      article: part.article,
      manufacturer: (part as any).manufacturer,
      cross_numbers: (part as any).cross_numbers ?? [],
      quantity: qty,
      reason,
    });
    if (error) { toast.error(error.message); return; }
    // Write off from stock
    const { data: userData } = await supabase.auth.getUser();
    await (supabase as any).from("spare_part_movements").insert({
      organization_id: orgId,
      spare_part_id: part.id,
      type: "WRITE_OFF",
      quantity: qty,
      reason: "Перевод в неликвид",
      created_by: userData.user?.id ?? null,
    });
    qc.invalidateQueries({ queryKey: ["spare-parts-list"] });
    qc.invalidateQueries({ queryKey: ["spare-part-deadstock"] });
    qc.invalidateQueries({ queryKey: ["spare-part-movements", part.id] });
    toast.success("Перемещено в неликвид");
  };

  const storage = [part.storage_location, part.rack && `Стеллаж ${part.rack}`, part.shelf && `Полка ${part.shelf}`, part.cell && `Ячейка ${part.cell}`].filter(Boolean).join(" • ");
  const stock = part.stock ?? 0;
  const lowStock = stock <= (part.min_stock ?? 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {part.name}
              {part.article && <span className="text-sm text-muted-foreground font-normal">({part.article})</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant={lowStock ? "destructive" : "secondary"}>
              Остаток: {stock} {part.unit ?? "шт"}
            </Badge>
            {lowStock && <Badge variant="outline">Ниже мин. ({part.min_stock ?? 0})</Badge>}
            {part.category && <Badge variant="outline">{part.category}</Badge>}
            {(part as any).manufacturer && <Badge variant="outline">{(part as any).manufacturer}</Badge>}
            {part.price && <Badge variant="outline"><RussianRuble className="h-3 w-3 mr-1" />{part.price}</Badge>}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button size="sm" onClick={() => setMovDialog("IN")}><ArrowDownToLine className="h-4 w-4 mr-1" />Приход</Button>
            <Button size="sm" variant="outline" onClick={() => setMovDialog("WRITE_OFF")}><ArrowUpFromLine className="h-4 w-4 mr-1" />Списание</Button>
            <Button size="sm" variant="outline" onClick={() => setMovDialog("SALE")}><RussianRuble className="h-4 w-4 mr-1" />Продажа</Button>
            <Button size="sm" variant="outline" onClick={() => setMovDialog("ADJUST")}>Корректировка</Button>
            <Button size="sm" variant="outline" onClick={moveToDeadstock}><Archive className="h-4 w-4 mr-1" />В неликвид</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" />Редактировать</Button>
          </div>

          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Инфо</TabsTrigger>
              <TabsTrigger value="compat">Совместимость ({compat.length})</TabsTrigger>
              <TabsTrigger value="history">История ({movements.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Артикул" value={part.article} />
                <InfoRow label="Производитель" value={(part as any).manufacturer} />
                <InfoRow label="Категория" value={part.category} />
                <InfoRow label="Ед. изм." value={part.unit} />
                <InfoRow label="Мин. остаток" value={String(part.min_stock ?? 0)} />
                <InfoRow label="Цена закупки" value={(part as any).purchase_price ? `${(part as any).purchase_price} ₽` : null} />
                <InfoRow label="Цена продажи" value={part.price ? `${part.price} ₽` : null} />
                <InfoRow label="Место хранения" value={storage || null} />
                <InfoRow label="Последнее поступление" value={(part as any).last_receipt_at ? format(new Date((part as any).last_receipt_at), "dd.MM.yyyy") : null} />
                <InfoRow label="Кросс-номера" value={((part as any).cross_numbers ?? []).join(", ") || null} />
              </div>
              {part.notes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Примечание</div>
                  <div className="whitespace-pre-wrap">{part.notes}</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="compat">
              {compat.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Совместимость не указана</div>
              ) : (
                <div className="space-y-1">
                  {compat.map((c: any) => c.equipment && (
                    <div key={c.equipment_id} className="flex items-center gap-2 text-sm py-1 border-b">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>{c.equipment.brand} {c.equipment.model}</span>
                      {c.equipment.plate_number && <Badge variant="outline">{c.equipment.plate_number}</Badge>}
                      {c.equipment.year && <span className="text-muted-foreground text-xs">{c.equipment.year}</span>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              {movements.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Движений нет</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Кол-во</TableHead>
                      <TableHead>Техника</TableHead>
                      <TableHead>Объект</TableHead>
                      <TableHead>Комментарий</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m: any) => {
                      const meta = MOVEMENT_LABELS[m.type] ?? { label: m.type, color: "" };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{format(new Date(m.created_at), "dd.MM.yy HH:mm")}</TableCell>
                          <TableCell><Badge className={meta.color} variant="secondary">{meta.label}</Badge></TableCell>
                          <TableCell className="text-right font-numeric">{m.quantity}</TableCell>
                          <TableCell className="text-xs">{m.equipment ? `${m.equipment.brand} ${m.equipment.model}` : "—"}</TableCell>
                          <TableCell className="text-xs">{m.object?.name ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {[m.reason, m.buyer, m.comment].filter(Boolean).join(" • ") || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {movDialog && (
        <SparePartMovementDialog
          open={!!movDialog}
          onOpenChange={(v) => !v && setMovDialog(null)}
          part={part}
          orgId={orgId}
          type={movDialog}
        />
      )}
      <SparePartFormDialog open={editOpen} onOpenChange={setEditOpen} orgId={orgId} part={part} />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}
