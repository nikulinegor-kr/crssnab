import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useProcurements } from "@/hooks/useProcurements";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { ProcurementDetail } from "./ProcurementDetail";
import { ProcurementExportButton } from "./ProcurementExportButton";

export const ProcurementList = () => {
  const { data: procurements, isLoading } = useProcurements();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      {procurements.map((p) => (
        <Card
          key={p.id}
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setSelectedId(p.id)}
        >
          <div className="flex items-center justify-between">
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
        </Card>
      ))}
    </div>
  );
};
