import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Truck, Lock, CheckCircle, AlertTriangle } from "lucide-react";

interface StockInfoCardProps {
  productId: string;
  warehouseId?: string;
  organizationId: string;
}

export const StockInfoCard = ({ productId, warehouseId, organizationId }: StockInfoCardProps) => {
  const { data: stockInfo, isLoading } = useQuery({
    queryKey: ["stock-info", productId, warehouseId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select("type, quantity")
        .eq("organization_id", organizationId)
        .eq("product_id", productId);

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let inStock = 0;
      let inTransit = 0;
      let reserved = 0;

      (data || []).forEach((m: any) => {
        switch (m.type) {
          case "IN":
          case "MOVE_IN":
            inStock += m.quantity;
            break;
          case "OUT":
          case "MOVE_OUT":
            inStock -= m.quantity;
            break;
          case "IN_TRANSIT":
            inTransit += m.quantity;
            break;
          case "RESERVE":
            reserved += m.quantity;
            break;
          case "UNRESERVE":
            reserved -= m.quantity;
            break;
        }
      });

      const available = inStock - reserved;

      return { inStock, inTransit, reserved, available };
    },
    enabled: !!productId && !!organizationId,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/30 p-3 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (!stockInfo) return null;

  const noStock = stockInfo.inStock <= 0 && stockInfo.inTransit <= 0;

  const items = [
    { label: "Остаток", value: stockInfo.inStock, icon: Package, color: "text-foreground" },
    { label: "В пути", value: stockInfo.inTransit, icon: Truck, color: "text-blue-600 dark:text-blue-400" },
    { label: "Резерв", value: stockInfo.reserved, icon: Lock, color: "text-amber-600 dark:text-amber-400" },
    { label: "Доступно", value: stockInfo.available, icon: CheckCircle, color: stockInfo.available > 0 ? "text-green-600 dark:text-green-400" : "text-destructive" },
  ];

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border/50 bg-muted/30 p-3">
        <div className="grid grid-cols-4 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center space-y-1">
              <item.icon className={`h-4 w-4 mx-auto ${item.color}`} />
              <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      {noStock && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Нет на складе — рекомендуется закупка</span>
        </div>
      )}
    </div>
  );
};
