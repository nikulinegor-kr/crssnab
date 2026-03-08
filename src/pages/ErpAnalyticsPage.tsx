import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Package, Truck, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(180, 50%, 45%)",
];

export default function ErpAnalyticsPage() {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();

  const { data: requests = [] } = useQuery({
    queryKey: ["erp-analytics-requests", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, description, status, amount, contractor, created_at, delivery_date, shipment_date, object_id, product_id, request_objects(name), warehouse_products(name)")
        .eq("organization_id", currentOrgId!)
        .eq("archived", false);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["erp-low-stock", currentOrgId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("warehouse_products")
        .select("id, name, article, min_stock, unit")
        .eq("organization_id", currentOrgId!)
        .gt("min_stock", 0);
      if (!products?.length) return [];

      const { data: movements } = await supabase
        .from("stock_movements")
        .select("product_id, type, quantity")
        .eq("organization_id", currentOrgId!)
        .in("product_id", products.map((p: any) => p.id));

      const stockMap: Record<string, number> = {};
      (movements || []).forEach((m: any) => {
        if (!stockMap[m.product_id]) stockMap[m.product_id] = 0;
        if (m.type === "IN" || m.type === "MOVE_IN") stockMap[m.product_id] += m.quantity;
        if (m.type === "OUT" || m.type === "MOVE_OUT" || m.type === "RESERVE") stockMap[m.product_id] -= m.quantity;
        if (m.type === "UNRESERVE") stockMap[m.product_id] += m.quantity;
      });

      return products
        .map((p: any) => ({ ...p, currentStock: stockMap[p.id] || 0 }))
        .filter((p: any) => p.currentStock < p.min_stock);
    },
    enabled: !!currentOrgId,
  });

  // Purchases by objects
  const purchasesByObject = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => {
      const name = r.request_objects?.name || "Без объекта";
      map[name] = (map[name] || 0) + (r.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [requests]);

  // Purchases by products
  const purchasesByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => {
      const name = r.warehouse_products?.name || r.description?.slice(0, 30) || "—";
      map[name] = (map[name] || 0) + (r.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [requests]);

  // Purchases by suppliers
  const purchasesBySupplier = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => {
      const name = r.contractor || "Без контрагента";
      map[name] = (map[name] || 0) + (r.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [requests]);

  // Average delivery time
  const avgDeliveryTime = useMemo(() => {
    const times: number[] = [];
    requests.forEach((r: any) => {
      if (r.created_at && r.delivery_date && r.status === "Доставлено") {
        const created = new Date(r.created_at).getTime();
        const delivered = new Date(r.delivery_date).getTime();
        const days = Math.round((delivered - created) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days < 365) times.push(days);
      }
    });
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  }, [requests]);

  // In-transit and overdue
  const today = new Date().toISOString().split("T")[0];
  const inTransit = requests.filter((r: any) => ["В пути", "Отправлено", "Доставлено в ТК"].includes(r.status));
  const overdue = requests.filter((r: any) => {
    if (!r.delivery_date || r.status === "Доставлено") return false;
    return r.delivery_date.split("T")[0] < today;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">ERP Аналитика</h1>
      </div>

      {/* Widgets row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/nomenclature")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Товары заканчиваются</p>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{lowStockItems.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/shipments")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Поставки в пути</p>
              <Truck className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{inTransit.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/requests")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Просроченные</p>
              <Clock className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{overdue.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Ср. срок поставки</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{avgDeliveryTime} дн.</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Objects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Закупки по объектам</CardTitle>
          </CardHeader>
          <CardContent>
            {purchasesByObject.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={purchasesByObject} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} ₽`} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Нет данных</p>}
          </CardContent>
        </Card>

        {/* By Suppliers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Закупки по поставщикам</CardTitle>
          </CardHeader>
          <CardContent>
            {purchasesBySupplier.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={purchasesBySupplier}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {purchasesBySupplier.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} ₽`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Нет данных</p>}
          </CardContent>
        </Card>

        {/* By Products */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Закупки по товарам (Топ-10)</CardTitle>
          </CardHeader>
          <CardContent>
            {purchasesByProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={purchasesByProduct} margin={{ bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} height={80} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} ₽`} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Нет данных</p>}
          </CardContent>
        </Card>
      </div>

      {/* Low stock list */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Товары заканчиваются
              <Badge variant="destructive">{lowStockItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-border/40">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.article && <span className="text-xs text-muted-foreground">({item.article})</span>}
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-destructive">{item.currentStock}</span>
                  <span className="text-xs text-muted-foreground ml-1">/ мин. {item.min_stock}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
