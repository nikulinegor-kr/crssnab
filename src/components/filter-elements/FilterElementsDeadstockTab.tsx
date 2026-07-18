import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Trash2, ShoppingCart } from "lucide-react";
import { useFilterElementsDeadstock } from "@/hooks/useFilterElements";
import { FilterDeadstockSaleDialog } from "./FilterDeadstockSaleDialog";
import { toast } from "sonner";

interface Props {
  orgId: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_stock: { label: "На складе", variant: "secondary" },
  for_sale: { label: "На продажу", variant: "default" },
  sold: { label: "Продано", variant: "outline" },
  written_off: { label: "Списано", variant: "destructive" },
};

export function FilterElementsDeadstockTab({ orgId }: Props) {
  const qc = useQueryClient();
  const { data: items = [] } = useFilterElementsDeadstock(orgId);
  const [search, setSearch] = useState("");
  const [sellItem, setSellItem] = useState<any | null>(null);

  const filtered = (items as any[]).filter((i) => {
    if (!search.trim()) return true;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = [i.name, i.article, i.manufacturer, i.compatibility, ...(i.cross_numbers ?? [])].filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("filter_element_deadstock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-element-deadstock"] });
      toast.success("Удалено");
    },
  });

  const sell = useMutation({
    mutationFn: async ({ id, current, data }: { id: string; current: any; data: any }) => {
      const remaining = Math.max(0, Number(current.quantity ?? 0) - Number(data.quantity));
      const { error } = await (supabase as any).from("filter_element_deadstock").update({
        buyer: data.buyer,
        sold_at: data.sold_at,
        actual_sale_price: data.actual_sale_price,
        sale_comment: data.sale_comment,
        quantity: remaining,
        status: remaining <= 0 ? "sold" : current.status,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filter-element-deadstock"] });
      setSellItem(null);
      toast.success("Продажа сохранена");
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Badge variant="secondary">{filtered.length} позиций</Badge>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Производитель</TableHead>
              <TableHead>Наименование</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Кросс-номер</TableHead>
              <TableHead>Совместимость</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead className="text-right">Рынок ₽</TableHead>
              <TableHead className="text-right">Продажа ₽</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Archive className="h-8 w-8 text-muted-foreground/40" />
                    <span>Неликвида нет</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i: any) => {
                const s = STATUS_LABEL[i.status] ?? { label: i.status, variant: "outline" as const };
                return (
                  <TableRow key={i.id} className={i.is_archived ? "opacity-70" : ""}>
                    <TableCell className="text-xs">{i.manufacturer || "—"}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-xs">{i.article || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(i.cross_numbers ?? []).slice(0, 3).map((c: string) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                        {(i.cross_numbers?.length ?? 0) > 3 && <Badge variant="outline" className="text-xs">+{i.cross_numbers.length - 3}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{i.compatibility || "—"}</TableCell>
                    <TableCell className="text-right font-numeric">{i.quantity}</TableCell>
                    <TableCell className="text-right font-numeric">{i.market_price ?? "—"}</TableCell>
                    <TableCell className="text-right font-numeric">{i.actual_sale_price ?? "—"}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell className="text-xs">{i.buyer || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {i.status !== "sold" && Number(i.quantity) > 0 && (
                          <Button size="icon" variant="ghost" onClick={() => setSellItem(i)} title="Продать">
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Удалить позицию?")) del.mutate(i.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {sellItem && (
        <FilterDeadstockSaleDialog
          open={!!sellItem}
          onOpenChange={(v) => !v && setSellItem(null)}
          maxQuantity={Number(sellItem.quantity ?? 0)}
          isPending={sell.isPending}
          onConfirm={(data) => sell.mutate({ id: sellItem.id, current: sellItem, data })}
        />
      )}
    </div>
  );
}
