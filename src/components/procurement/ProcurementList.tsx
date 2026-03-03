import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useProcurements, useDeleteProcurement } from "@/hooks/useProcurements";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ShoppingCart, ChevronRight, Trash2 } from "lucide-react";
import { ProcurementDetail } from "./ProcurementDetail";
import { useToast } from "@/hooks/use-toast";

export const ProcurementList = () => {
  const { data: procurements, isLoading } = useProcurements();
  const deleteProcurement = useDeleteProcurement();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      for (const id of Array.from(checkedIds)) {
        await deleteProcurement.mutateAsync(id);
      }
      toast({
        title: "Удалено",
        description: `Удалено закупов: ${checkedIds.size}`,
      });
      setCheckedIds(new Set());
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось удалить",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  if (selectedId) {
    return <ProcurementDetail procurementId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!procurements || procurements.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-lg font-semibold mb-1">Нет закупов</h3>
        <p className="text-sm text-muted-foreground">
          Выделите заявки и нажмите «Сформировать закуп»
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {checkedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Выбрано: {checkedIds.size}</span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Удалить
          </Button>
        </div>
      )}

      {procurements.map((p) => (
        <Card
          key={p.id}
          className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${checkedIds.has(p.id) ? "ring-2 ring-primary" : ""}`}
          onClick={() => setSelectedId(p.id)}
        >
          <div className="flex items-center gap-3">
            <div onClick={(e) => toggleCheck(p.id, e)} className="shrink-0">
              <Checkbox checked={checkedIds.has(p.id)} />
            </div>
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{p.name || "Закуп"}</h3>
                  <Badge variant={p.status === "draft" ? "secondary" : "default"}>
                    {p.status === "draft" ? "Черновик" : "Завершён"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{format(new Date(p.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}</span>
                  <span>{p.creator_name || "—"}</span>
                  <span>{p.items_count || 0} поз.</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-base">
                  {p.total_amount.toLocaleString("ru-RU")} ₽
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </Card>
      ))}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить закупы</AlertDialogTitle>
            <AlertDialogDescription>
              Вы действительно хотите удалить {checkedIds.size} закуп(ов)? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
