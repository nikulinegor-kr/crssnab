import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export const LowStockWidget = () => {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();

  const { data: lowStockItems = [], isLoading } = useQuery({
    queryKey: ["low-stock-items", currentOrgId],
    queryFn: async () => {
      // Get products with min_stock > 0
      const { data: products, error: pErr } = await supabase
        .from("warehouse_products")
        .select("id, name, article, min_stock, unit, equipment:equipment_id(brand, model)")
        .eq("organization_id", currentOrgId!)
        .gt("min_stock", 0);
      if (pErr) throw pErr;
      if (!products || products.length === 0) return [];

      // Get all stock movements for these products
      const productIds = products.map((p: any) => p.id);
      const { data: movements, error: mErr } = await supabase
        .from("stock_movements")
        .select("product_id, type, quantity")
        .eq("organization_id", currentOrgId!)
        .in("product_id", productIds);
      if (mErr) throw mErr;

      // Calculate stock per product
      const stockMap: Record<string, number> = {};
      (movements || []).forEach((m: any) => {
        if (!stockMap[m.product_id]) stockMap[m.product_id] = 0;
        switch (m.type) {
          case "IN": case "MOVE_IN":
            stockMap[m.product_id] += m.quantity; break;
          case "OUT": case "MOVE_OUT":
            stockMap[m.product_id] -= m.quantity; break;
          case "RESERVE":
            stockMap[m.product_id] -= m.quantity; break;
          case "UNRESERVE":
            stockMap[m.product_id] += m.quantity; break;
        }
      });

      return products
        .map((p: any) => ({
          ...p,
          currentStock: stockMap[p.id] || 0,
        }))
        .filter((p: any) => p.currentStock < p.min_stock);
    },
    enabled: !!currentOrgId,
    refetchInterval: 60000,
  });

  if (isLoading || lowStockItems.length === 0) return null;

  return (
    <Card className="bg-card border-amber-500/30 shadow-sm">
      <CardHeader className="pb-3 p-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Товары заканчиваются
          <Badge variant="destructive" className="ml-auto">{lowStockItems.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {lowStockItems.slice(0, 5).map((item: any) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2.5 rounded-md border border-border/40 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => navigate("/nomenclature")}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.equipment && (
                  <p className="text-xs text-muted-foreground">
                    {(item.equipment as any).brand} {(item.equipment as any).model}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-sm font-semibold text-destructive">{item.currentStock} {item.unit || "шт"}</p>
              <p className="text-xs text-muted-foreground">мин: {item.min_stock}</p>
            </div>
          </div>
        ))}
        {lowStockItems.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            и ещё {lowStockItems.length - 5} товаров...
          </p>
        )}
      </CardContent>
    </Card>
  );
};
