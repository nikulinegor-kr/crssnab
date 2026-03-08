import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, AlertTriangle, Plus, ShoppingCart, Package } from "lucide-react";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";

export default function ProcurementPlanPage() {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();

  const { data: products = [] } = useQuery({
    queryKey: ["plan-products", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_products")
        .select("id, name, article, unit, min_stock, equipment:equipment_id(brand, model)")
        .eq("organization_id", currentOrgId!)
        .gt("min_stock", 0)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["plan-movements", currentOrgId],
    queryFn: async () => {
      if (!products.length) return [];
      const { data, error } = await supabase
        .from("stock_movements")
        .select("product_id, type, quantity")
        .eq("organization_id", currentOrgId!)
        .in("product_id", products.map((p: any) => p.id));
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && products.length > 0,
  });

  // Active requests with product_id
  const { data: activeRequests = [] } = useQuery({
    queryKey: ["plan-active-requests", currentOrgId],
    queryFn: async () => {
      if (!products.length) return [];
      const { data, error } = await supabase
        .from("requests")
        .select("product_id, quantity, status")
        .eq("organization_id", currentOrgId!)
        .eq("archived", false)
        .not("status", "in", '("Доставлено","Выполнено","Отменено","Закрыто")')
        .in("product_id", products.map((p: any) => p.id));
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && products.length > 0,
  });

  const planItems = useMemo(() => {
    // Stock map
    const stockMap: Record<string, { stock: number; reserve: number; inTransit: number }> = {};
    (movements || []).forEach((m: any) => {
      if (!stockMap[m.product_id]) stockMap[m.product_id] = { stock: 0, reserve: 0, inTransit: 0 };
      const e = stockMap[m.product_id];
      switch (m.type) {
        case "IN": case "MOVE_IN": e.stock += m.quantity; break;
        case "OUT": case "MOVE_OUT": e.stock -= m.quantity; break;
        case "RESERVE": e.reserve += m.quantity; break;
        case "UNRESERVE": e.reserve -= m.quantity; break;
        case "IN_TRANSIT": e.inTransit += m.quantity; break;
      }
    });

    // Active orders map
    const orderedMap: Record<string, number> = {};
    (activeRequests || []).forEach((r: any) => {
      if (r.product_id) {
        orderedMap[r.product_id] = (orderedMap[r.product_id] || 0) + (r.quantity || 1);
      }
    });

    return products.map((p: any) => {
      const s = stockMap[p.id] || { stock: 0, reserve: 0, inTransit: 0 };
      const available = s.stock - s.reserve;
      const ordered = orderedMap[p.id] || 0;
      const expectedAfterOrders = available + s.inTransit + ordered;
      const deficit = Math.max(0, (p.min_stock || 0) - expectedAfterOrders);
      const needsOrder = available < (p.min_stock || 0);

      return {
        ...p,
        stock: s.stock,
        reserve: s.reserve,
        inTransit: s.inTransit,
        available,
        ordered,
        deficit,
        needsOrder,
      };
    }).filter((p: any) => p.needsOrder);
  }, [products, movements, activeRequests]);

  const totalDeficit = planItems.reduce((sum: number, p: any) => sum + p.deficit, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">План закупок</h1>
          {planItems.length > 0 && (
            <Badge variant="destructive">{planItems.length} позиций</Badge>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Требуют закупки</p>
            <p className="text-2xl font-bold text-destructive">{planItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Общий дефицит</p>
            <p className="text-2xl font-bold">{totalDeficit} ед.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Всего с мин. остатком</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead>Техника</TableHead>
              <TableHead className="text-right">Остаток</TableHead>
              <TableHead className="text-right">Резерв</TableHead>
              <TableHead className="text-right">В пути</TableHead>
              <TableHead className="text-right">Заказано</TableHead>
              <TableHead className="text-right">Мин.</TableHead>
              <TableHead className="text-right">Дефицит</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {planItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p>Все товары в норме</p>
                </TableCell>
              </TableRow>
            ) : (
              planItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.article && <p className="text-xs text-muted-foreground">{item.article}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.equipment ? (
                      <Badge variant="secondary" className="font-normal text-xs">
                        {(item.equipment as any).brand} {(item.equipment as any).model}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.stock}</TableCell>
                  <TableCell className="text-right">{item.reserve}</TableCell>
                  <TableCell className="text-right">{item.inTransit}</TableCell>
                  <TableCell className="text-right">{item.ordered}</TableCell>
                  <TableCell className="text-right">{item.min_stock}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive">{item.deficit}</Badge>
                  </TableCell>
                  <TableCell>
                    <CreateRequestDialog>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Заявка
                      </Button>
                    </CreateRequestDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
