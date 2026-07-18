import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFilterElementMovements, type FilterElementRow } from "@/hooks/useFilterElements";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "react-router-dom";

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
  MOVE: { label: "Перемещение", variant: "secondary" },
};


const fmtRub = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;

export function FilterElementDetailDialog({ open, onOpenChange, item }: Props) {
  const { data: movements = [] } = useFilterElementMovements(open ? item.id : null);

  const priceHistory = useMemo(
    () => (movements as any[]).filter((m) => m.type === "IN" && m.unit_price != null && Number(m.unit_price) > 0),
    [movements],
  );

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

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Последняя цена</div>
              <div className="text-lg font-semibold font-numeric">{fmtRub(item.last_price)}</div>
              {item.last_purchase_at && (
                <div className="text-[10px] text-muted-foreground">
                  {format(new Date(item.last_purchase_at), "dd.MM.yyyy", { locale: ru })}
                </div>
              )}
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Средняя закупочная</div>
              <div className="text-lg font-semibold font-numeric">{fmtRub(item.avg_price)}</div>
              <div className="text-[10px] text-muted-foreground">Автоматический пересчёт</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Закупок учтено</div>
              <div className="text-lg font-semibold font-numeric">{item.purchase_count ?? 0}</div>
            </Card>
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
            <div className="text-xs text-muted-foreground mb-2">История цен (закупки)</div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Заявка</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Цена закупки</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Закупочные цены ещё не фиксировались. Укажите цену в диалоге «Пополнить».
                    </TableCell></TableRow>
                  ) : (
                    priceHistory.map((m: any) => {
                      const total = Number(m.unit_price) * Number(m.quantity);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{format(new Date(m.created_at), "dd.MM.yyyy", { locale: ru })}</TableCell>
                          <TableCell className="text-xs">
                            {m.request ? (
                              <Link to={`/requests/${m.request.id}`} className="text-primary hover:underline">
                                {m.request.description ?? "Заявка"}
                              </Link>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{m.supplier ?? "—"}</TableCell>
                          <TableCell className="text-right font-numeric text-xs">{m.quantity}</TableCell>
                          <TableCell className="text-right font-numeric">{fmtRub(m.unit_price)}</TableCell>
                          <TableCell className="text-right font-numeric text-muted-foreground">{fmtRub(total)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Движение</div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Операция</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead>Документ</TableHead>
                    <TableHead>Со склада → на склад</TableHead>
                    <TableHead>Техника / объект</TableHead>
                    <TableHead>Ответственный</TableHead>
                    <TableHead>Причина / комментарий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movements as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Пока нет операций</TableCell></TableRow>
                  ) : (
                    (movements as any[]).map((m: any) => {
                      const t = TYPE_LABEL[m.type] ?? { label: m.type, variant: "outline" as const };
                      const move = m.type === "MOVE"
                        ? `${m.from_location ?? "—"} → ${m.to_location ?? "—"}`
                        : "—";
                      const eqObj = [
                        m.equipment ? `${m.equipment.brand ?? ""} ${m.equipment.model ?? ""}`.trim() : null,
                        m.object?.name ?? null,
                      ].filter(Boolean).join(" • ") || "—";
                      const reasonComment = [m.reason, m.comment].filter(Boolean).join(" — ") || "—";
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{format(new Date(m.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}</TableCell>
                          <TableCell><Badge variant={t.variant}>{t.label}</Badge></TableCell>
                          <TableCell className="text-right font-numeric">{m.quantity}</TableCell>
                          <TableCell className="text-xs">{m.document_number ?? "—"}</TableCell>
                          <TableCell className="text-xs">{move}</TableCell>
                          <TableCell className="text-xs">{eqObj}</TableCell>
                          <TableCell className="text-xs">{m.responsible?.full_name ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{reasonComment}</TableCell>
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
