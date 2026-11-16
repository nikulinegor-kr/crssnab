import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
import {
  getInvoiceDeletePatch,
  getInvoiceResetPatch,
  getRequestInvoiceRequisites,
  hasInvoiceRequisites,
  type RequestInvoiceRecord,
} from "@/lib/requestInvoices";

const money = (value: number | null) => value == null
  ? "—"
  : `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ₽`;

interface RequestInvoiceActionsProps {
  request: RequestInvoiceRecord & { id: string };
  readOnly?: boolean;
  onUpdated?: (patch: Record<string, null>) => void;
}

export function RequestInvoiceRequisites({ request }: { request: RequestInvoiceRecord }) {
  const values = getRequestInvoiceRequisites(request, 1);
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-left text-sm">
      <span className="text-muted-foreground">Сумма</span><span className="break-words font-numeric text-foreground">{money(values.amount)}</span>
      <span className="text-muted-foreground">Номер счёта</span><span className="break-words text-foreground">{values.invoiceNumber || "—"}</span>
      <span className="text-muted-foreground">Контрагент</span><span className="break-words text-foreground">{values.contractor || "—"}</span>
    </div>
  );
}

export function RequestInvoiceActions({ request, readOnly, onUpdated }: RequestInvoiceActionsProps) {
  const [action, setAction] = useState<"reset" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  if (readOnly) return null;

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const patch = action === "reset" ? getInvoiceResetPatch(1) : getInvoiceDeletePatch(1);
      const { error } = await supabase.from("requests").update(patch).eq("id", request.id);
      if (error) throw error;
      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: unknown) =>
        Array.isArray(old) ? old.map((item) => item?.id === request.id ? { ...item, ...patch } : item) : old
      );
      queryClient.setQueryData(["request", request.id], (old: unknown) => old && typeof old === "object" ? { ...old, ...patch } : old);
      onUpdated?.(patch);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", request.id] }),
      ]);
      toast({
        title: action === "reset" ? "Реквизиты сброшены" : "Счёт удалён",
        description: "Документы и другие счета сохранены",
      });
      setAction(null);
    } catch (error) {
      console.error("Request invoice action:", error);
      toast({ title: "Не удалось изменить счёт", description: "Данные не изменены", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" disabled={!hasInvoiceRequisites(request)} onClick={() => setAction("reset")}>
        <RotateCcw className="h-3.5 w-3.5" />Сбросить реквизиты
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!hasInvoiceRequisites(request)} onClick={() => setAction("delete")}>
        <Trash2 className="h-3.5 w-3.5" />Удалить счёт
      </Button>
      <AlertDialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action === "reset" ? "Сбросить реквизиты основного счёта?" : "Удалить основной счёт?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {action === "reset"
                ? "Будут очищены только сумма, номер счёта и контрагент. Дата счёта, документы и другие счета сохранятся."
                : "Реквизиты основного счёта будут удалены. Связанные документы и другие счета сохранятся."}
            </AlertDialogDescription>
            <RequestInvoiceRequisites request={request} />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run()} disabled={busy}>
              {busy ? "Сохранение…" : action === "reset" ? "Сбросить реквизиты" : "Удалить счёт"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
