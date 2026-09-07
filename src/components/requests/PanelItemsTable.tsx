import { useEffect, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface PanelItem {
  id: string;
  name: string;
  article: string | null;
  quantity: number;
  price: number;
}

interface PanelItemsTableProps {
  requestId: string;
  organizationId: string | null;
  items: PanelItem[];
  readOnly?: boolean;
  /** Итог по позициям подставляется в сумму заявки. */
  onTotalChange?: (total: number) => void;
}

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

/** Редактируемая таблица позиций заявки. */
export const PanelItemsTable = ({
  requestId,
  organizationId,
  items,
  readOnly,
  onTotalChange,
}: PanelItemsTableProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const total = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.price || 0), 0);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["request-items", requestId] });
  };

  const patch = async (id: string, field: keyof PanelItem, raw: string) => {
    const value =
      field === "quantity" || field === "price" ? Number(String(raw).replace(",", ".")) || 0 : raw || null;
    setBusyId(id);
    try {
      const { error } = await supabase.from("request_items").update({ [field]: value } as any).eq("id", id);
      if (error) throw error;
      refresh();
    } catch (e) {
      console.error("item save:", e);
      toast({ title: "Не удалось сохранить позицию", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const addRow = async () => {
    if (!organizationId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("request_items").insert({
        request_id: requestId,
        organization_id: organizationId,
        name: "Новая позиция",
        quantity: 1,
        price: 0,
      } as any);
      if (error) throw error;
      refresh();
    } catch (e) {
      console.error("item add:", e);
      toast({ title: "Не удалось добавить позицию", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeRow = async (id: string) => {
    setDeleteId(null);
    setBusyId(id);
    try {
      const { error } = await supabase.from("request_items").delete().eq("id", id);
      if (error) throw error;
      refresh();
    } catch (e) {
      console.error("item delete:", e);
      toast({ title: "Не удалось удалить позицию", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const cellClass =
    "w-full bg-transparent px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring rounded";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_70px_52px_64px_72px_20px] gap-1 text-[9.5px] text-muted-foreground">
        <span>Наименование</span>
        <span>Артикул</span>
        <span className="text-right">Кол-во</span>
        <span className="text-right">Цена</span>
        <span className="text-right">Сумма</span>
        <span />
      </div>

      {items.length === 0 && <div className="text-[11px] text-muted-foreground">Позиций нет</div>}

      {items.map((it) => (
        <div
          key={it.id}
          className="grid grid-cols-[1fr_70px_52px_64px_72px_20px] items-center gap-1 border-b border-border/70 pb-1"
        >
          <input
            defaultValue={it.name}
            readOnly={readOnly}
            onBlur={(e) => e.target.value !== it.name && patch(it.id, "name", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={cellClass}
          />
          <input
            defaultValue={it.article ?? ""}
            readOnly={readOnly}
            onBlur={(e) => e.target.value !== (it.article ?? "") && patch(it.id, "article", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`${cellClass} font-numeric`}
          />
          <input
            type="number"
            defaultValue={it.quantity}
            readOnly={readOnly}
            onBlur={(e) => Number(e.target.value) !== it.quantity && patch(it.id, "quantity", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`${cellClass} font-numeric text-right`}
          />
          <input
            type="number"
            defaultValue={it.price}
            readOnly={readOnly}
            onBlur={(e) => Number(e.target.value) !== it.price && patch(it.id, "price", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className={`${cellClass} font-numeric text-right`}
          />
          <span className="font-numeric px-1 text-right text-[11px]">
            {money((it.quantity || 0) * (it.price || 0))}
          </span>
          {readOnly ? (
            <span />
          ) : busyId === it.id ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              aria-label="Удалить позицию"
              onClick={() => setDeleteId(it.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        {!readOnly && (
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={addRow} disabled={adding}>
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Добавить позицию
          </Button>
        )}
        <span className="font-numeric ml-auto text-[12px] font-semibold">{money(total)} ₽</span>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
            <AlertDialogDescription>Позиция будет удалена из заявки без возможности вернуть.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && removeRow(deleteId)}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
