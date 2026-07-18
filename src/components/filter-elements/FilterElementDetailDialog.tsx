import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFilterElementMovements, type FilterElementRow } from "@/hooks/useFilterElements";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FilterElementRow;
}

const TYPE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  IN: { label: "Поступление", variant: "default" },
  WRITE_OFF: { label: "Списание", variant: "destructive" },
  ADJUST: { label: "Корректировка", variant: "secondary" },
  RETURN: { label: "Возврат", variant: "outline" },
};

export function FilterElementDetailDialog({ open, onOpenChange, item }: Props) {
  const { data: movements = [] } = useFilterElementMovements(open ? item.id : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Производитель</div><div>{item.manufacturer || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Артикул</div><div>{item.article || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Ед. изм.</div><div>{item.unit}</div></div>
            <div><div className="text-xs text-muted-foreground">Остаток</div><div className="font-numeric">{item.stock ?? 0}</div></div>
            <div><div className="text-xs text-muted-foreground">Мин. остаток</div><div className="font-numeric">{item.min_stock}</div></div>
            <div><div className="text-xs text-muted-foreground">Место хранения</div><div>{item.storage_location || "—"}</div></div>
          </div>

          {(item.cross_numbers?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Кросс-номера</div>
              <div className="flex flex-wrap gap-1">
                {item.cross_numbers!.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
              </div>
            </div>
          )}

          {(item.equipment?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Совместимая техника</div>
              <div className="flex flex-wrap gap-1">
                {item.equipment!.map((e) => (
                  <Badge key={e.id} variant="outline">
                    {e.brand} {e.model} {e.plate_number ? `• ${e.plate_number}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-muted-foreground mb-2">История движений</div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Операция</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead>Техника</TableHead>
                    <TableHead>Объект</TableHead>
                    <TableHead>Ответственный</TableHead>
                    <TableHead>Комментарий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Пока нет операций</TableCell></TableRow>
                  ) : (
                    movements.map((m: any) => {
                      const t = TYPE_LABEL[m.type] ?? { label: m.type, variant: "outline" as const };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{format(new Date(m.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}</TableCell>
                          <TableCell><Badge variant={t.variant}>{t.label}</Badge></TableCell>
                          <TableCell className="text-right font-numeric">{m.quantity}</TableCell>
                          <TableCell className="text-xs">{m.equipment ? `${m.equipment.brand ?? ""} ${m.equipment.model ?? ""}`.trim() : "—"}</TableCell>
                          <TableCell className="text-xs">{m.object?.name ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.responsible?.full_name ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{m.comment ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
