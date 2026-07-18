import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Trash2, ShoppingCart } from "lucide-react";
import { useSparePartsDeadstock } from "@/hooks/useSpareParts";
import { DeadstockSoldDialog } from "@/components/deadstock/DeadstockSoldDialog";
import { toast } from "sonner";

interface Props {
  orgId: string;
}

export function SparePartsDeadstockTab({ orgId }: Props) {
  const qc = useQueryClient();
  const { data: items = [] } = useSparePartsDeadstock(orgId);
  const [search, setSearch] = useState("");
  const [sellId, setSellId] = useState<string | null>(null);

  const filtered = items.filter((i: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name?.toLowerCase().includes(q) || i.article?.toLowerCase().includes(q) || i.manufacturer?.toLowerCase().includes(q));
  });

  const total = filtered.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.market_price) || 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("spare_part_deadstock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spare-part-deadstock"] });
      toast.success("Удалено");
    },
  });

  const sell = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await (supabase as any).from("spare_part_deadstock").update({
        sold_at: data.sold_at,
        buyer: data.buyer,
        sale_price: data.sale_price ? Number(data.sale_price) : null,
        comment: [data.invoice_number && `Счёт ${data.invoice_number}`, data.tk && `ТК ${data.tk}`].filter(Boolean).join(" • ") || null,
        quantity: 0,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spare-part-deadstock"] });
      setSellId(null);
      toast.success("Продажа сохранена");
    },
  });

  const active = filtered.filter((i: any) => !i.is_archived);
  const archived = filtered.filter((i: any) => i.is_archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Badge variant="secondary">{active.length} активных</Badge>
        <Badge variant="outline">Оценка: {total.toLocaleString("ru-RU")} ₽</Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead className="text-right">Рынок ₽</TableHead>
              <TableHead className="text-right">Продано ₽</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead>Причина</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...active, ...archived].map((i: any) => (
              <TableRow key={i.id} className={i.is_archived ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  {i.name}
                  {i.is_archived && <Badge variant="outline" className="ml-2 text-xs">Продано</Badge>}
                </TableCell>
                <TableCell>{i.article || "—"}</TableCell>
                <TableCell className="text-right font-numeric">{i.quantity}</TableCell>
                <TableCell className="text-right font-numeric">{i.market_price ?? "—"}</TableCell>
                <TableCell className="text-right font-numeric">{i.sale_price ?? "—"}</TableCell>
                <TableCell className="text-xs">{i.buyer || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{i.reason || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {!i.is_archived && (
                      <Button size="icon" variant="ghost" onClick={() => setSellId(i.id)} title="Продать">
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Удалить позицию?")) del.mutate(i.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Archive className="h-8 w-8 text-muted-foreground/40" />
                    <span>Неликвида нет</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {sellId && (
        <DeadstockSoldDialog
          open={!!sellId}
          onOpenChange={(v) => !v && setSellId(null)}
          onConfirm={(data) => sell.mutate({ id: sellId, data: { ...data, sale_price: (items.find((x: any) => x.id === sellId) as any)?.market_price } })}
          isPending={sell.isPending}
        />
      )}
    </div>
  );
}
