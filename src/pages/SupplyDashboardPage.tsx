import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, FileText, Truck, AlertCircle, Clock, Package, AlertTriangle, CalendarDays } from "lucide-react";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { Plus } from "lucide-react";

export default function SupplyDashboardPage() {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["supply-dash-requests", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, priority, amount, contractor, delivery_date, created_at, product_id")
        .eq("organization_id", currentOrgId!)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["supply-dash-lowstock", currentOrgId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("warehouse_products")
        .select("id, min_stock")
        .eq("organization_id", currentOrgId!)
        .gt("min_stock", 0);
      if (!products?.length) return 0;

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

      return products.filter((p: any) => (stockMap[p.id] || 0) < p.min_stock).length;
    },
    enabled: !!currentOrgId,
  });

  const today = new Date().toISOString().split("T")[0];

  const stats = useMemo(() => {
    const total = requests.length;
    const newRequests = requests.filter((r: any) => r.status === "Новая");
    const inProgress = requests.filter((r: any) => !["Новая", "Доставлено", "Выполнено", "Отменено", "Закрыто"].includes(r.status));
    const inTransit = requests.filter((r: any) => ["В пути", "Отправлено"].includes(r.status));
    const deliveredTk = requests.filter((r: any) => r.status === "Доставлено в ТК");
    const delivered = requests.filter((r: any) => r.status === "Доставлено");
    const todayDeliveries = requests.filter((r: any) => r.delivery_date?.split("T")[0] === today && r.status !== "Доставлено");
    const emergency = inProgress.filter((r: any) => r.priority === "Аварийно");
    const overdue = requests.filter((r: any) => {
      if (!r.delivery_date || r.status === "Доставлено") return false;
      return r.delivery_date.split("T")[0] < today;
    });
    return { total, newRequests, inProgress, inTransit, deliveredTk, delivered, todayDeliveries, emergency, overdue };
  }, [requests, today]);

  const summaryCards = [
    { title: "Всего заявок", value: stats.total, icon: FileText, color: "text-foreground" },
    { title: "Новых", value: stats.newRequests.length, icon: Plus, color: "text-primary" },
    { title: "Выполняется", value: stats.inProgress.length, icon: Boxes, color: "text-amber-500" },
    { title: "В пути", value: stats.inTransit.length, icon: Truck, color: "text-blue-500" },
    { title: "Доставлено в ТК", value: stats.deliveredTk.length, icon: Package, color: "text-indigo-500" },
    { title: "Доставлено", value: stats.delivered.length, icon: Package, color: "text-green-500" },
  ];

  const cards = [
    { title: "Выполняется", value: stats.inProgress.length, icon: FileText, color: "text-primary", onClick: () => navigate("/requests?status=in_progress") },
    { title: "Поставки в пути", value: stats.inTransit.length, icon: Truck, color: "text-blue-500", onClick: () => navigate("/shipments") },
    { title: "Поставки сегодня", value: stats.todayDeliveries.length, icon: CalendarDays, color: "text-green-500", onClick: () => navigate("/shipments") },
    { title: "Товары заканчиваются", value: lowStockCount, icon: AlertTriangle, color: "text-amber-500", onClick: () => navigate("/procurement-plan") },
    { title: "Аварийные заявки", value: stats.emergency.length, icon: AlertCircle, color: "text-destructive", onClick: () => navigate("/requests?priority=Аварийно") },
    { title: "Просроченные", value: stats.overdue.length, icon: Clock, color: "text-destructive", onClick: () => navigate("/requests") },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Дашборд снабжения</h1>
        </div>
        <CreateRequestDialog>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Новая заявка
          </Button>
        </CreateRequestDialog>
      </div>

      {/* Summary Block */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              onClick={card.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Emergency requests */}
      {stats.emergency.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Аварийные заявки
              <Badge variant="destructive">{stats.emergency.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.emergency.slice(0, 5).map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/requests/${r.id}`)}>
                      <TableCell className="font-medium text-sm">{r.request_number}</TableCell>
                      <TableCell className="text-sm truncate max-w-[250px]">{r.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contractor || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
                      <TableCell className="text-sm">{r.amount ? `${r.amount.toLocaleString()} ₽` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today deliveries */}
      {stats.todayDeliveries.length > 0 && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-green-500" />
              Поставки сегодня
              <Badge className="bg-green-500">{stats.todayDeliveries.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.todayDeliveries.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2.5 rounded-md border border-border/40 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/requests/${r.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{r.request_number} — {r.description?.slice(0, 50)}</p>
                    <p className="text-xs text-muted-foreground">{r.contractor || "—"}</p>
                  </div>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* In transit */}
      {stats.inTransit.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              Поставки в пути
              <Badge variant="secondary">{stats.inTransit.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Дата доставки</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.inTransit.slice(0, 10).map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/requests/${r.id}`)}>
                      <TableCell className="font-medium text-sm">{r.request_number}</TableCell>
                      <TableCell className="text-sm truncate max-w-[250px]">{r.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contractor || "—"}</TableCell>
                      <TableCell className="text-sm">{r.delivery_date ? new Date(r.delivery_date).toLocaleDateString("ru-RU") : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue */}
      {stats.overdue.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              Просроченные поставки
              <Badge variant="destructive">{stats.overdue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.overdue.slice(0, 5).map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2.5 rounded-md border border-destructive/20 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/requests/${r.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{r.request_number} — {r.description?.slice(0, 50)}</p>
                    <p className="text-xs text-muted-foreground">Ожидалось: {new Date(r.delivery_date).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
