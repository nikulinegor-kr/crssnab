import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle, BarChart3 } from "lucide-react";
import { LowStockWidget } from "@/components/dashboard/LowStockWidget";
import { MyPlannerTasksWidget } from "@/components/dashboard/MyPlannerTasksWidget";
import { useRequests } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { useQuickRequest } from "@/components/quick-request/QuickRequestProvider";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { Request } from "@/hooks/useRequests";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { ClosureTimeAnalytics } from "@/components/analytics/ClosureTimeAnalytics";
import { EmergencyRequestsWidget } from "@/components/dashboard/EmergencyRequestsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useUserRole } from "@/hooks/useUserRole";

type PeriodKey = "today" | "7d" | "30d" | "month" | "all";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];

function getPeriodStart(key: PeriodKey): Date | null {
  const now = new Date();
  switch (key) {
    case "today": {
      const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
    }
    case "7d": {
      const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d;
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d;
    }
    case "month": {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case "all": return null;
  }
}


const Dashboard = () => {
  const rawNavigate = useNavigate();
  const { open: openQuickRequest } = useQuickRequest();
  // Clear saved filters before navigating to /requests so dashboard filter is the only active one
  const navigate = useCallback((path: string) => {
    if (path.startsWith("/requests")) {
      localStorage.removeItem("requests_filters");
    }
    rawNavigate(path);
  }, [rawNavigate]);
  const { data: requests, isLoading: requestsLoading, refetch } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const { settings } = useViewSettings();
  const { isAdmin } = useUserRole();

  const availableYears = useMemo(() => {
    if (!requests) return [new Date().getFullYear().toString()];
    const years = new Set(
      requests.filter(r => r.request_date).map(r => new Date(r.request_date).getFullYear().toString())
    );
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [requests]);

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    // First filter by year
    const yearFiltered = requests.filter(r => {
      if (!r.request_date) return false;
      return new Date(r.request_date).getFullYear().toString() === selectedYear;
    });
    // Then apply period
    if (!periodStart) return yearFiltered;
    return yearFiltered.filter(r => new Date(r.created_at) >= periodStart);
  }, [requests, periodStart, selectedYear]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const stats = useMemo(() => {
    const all = filteredRequests;
    const active = all.filter(r => !["Доставлено", "Выполнено", "Отменено", "Закрыто"].includes(r.status));

    // Urgency
    const emergency = active.filter(r => r.priority === "Аварийно").length;
    const priority = active.filter(r => r.priority === "Приоритетно").length;
    const planned = active.filter(r => r.priority === "Планово" || !r.priority).length;

    // Work
    const newRequests = all.filter(r => r.status === "Новая заявка").length;
    const inProgress = all.filter(r => ["В работе", "КП", "На согласовании", "Счёт", "Счёт в Бухгалтерии"].includes(r.status)).length;
    const inTransit = all.filter(r => r.status === "В пути" || r.status === "Отправлено").length;

    // Problems — overdue = delivery_date < today AND not delivered
    const overdue = active.filter(r => {
      if (!r.delivery_date) return false;
      return r.delivery_date.split("T")[0] < today;
    }).length;

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const stale = active.filter(r => {
      const updated = new Date(r.updated_at);
      return updated < twoDaysAgo;
    }).length;

    const notPickedUp = all.filter(r => r.status === "Доставлено в ТК").length;

    // Logistics
    const deliveryToday = all.filter(r => r.delivery_date?.split("T")[0] === today && !["Доставлено", "Выполнено"].includes(r.status)).length;
    const overdueShipment = all.filter(r => {
      if (!(r as any).shipment_date) return false;
      if (["В пути", "Доставлено", "Доставлено в ТК", "Выполнено", "Отменено", "Закрыто"].includes(r.status)) return false;
      return (r as any).shipment_date.split("T")[0] < today;
    }).length;

    // Finance — only requests WITH invoice (invoice_number not empty)
    const withInvoice = all.filter(r => r.invoice_number && r.invoice_number.trim() !== "");
    const unpaid = withInvoice.filter(r => r.payment_status !== "Оплачено" && r.payment_status !== "Частично оплачено").length;
    const partiallyPaid = withInvoice.filter(r => r.payment_status === "Частично оплачено").length;
    const paid = withInvoice.filter(r => r.payment_status === "Оплачено").length;

    // Efficiency
    const completed = all.filter(r => r.status === "Доставлено").length;
    const completionRate = all.length > 0 ? Math.round((completed / all.length) * 100) : 0;

    // Average times
    const completedWithDates = all.filter(r => r.status === "Доставлено" && r.created_at);
    
    let avgCreationToOrder = 0;
    let avgOrderToDelivery = 0;
    let avgFullCycle = 0;

    if (completedWithDates.length > 0) {
      const cycles = completedWithDates.map(r => {
        const created = new Date(r.created_at).getTime();
        const shipment = r.shipment_date ? new Date(r.shipment_date).getTime() : null;
        const delivery = r.delivery_date ? new Date(r.delivery_date).getTime() : null;
        return { created, shipment, delivery };
      });

      const withShipment = cycles.filter(c => c.shipment);
      if (withShipment.length > 0) {
        avgCreationToOrder = Math.round(withShipment.reduce((sum, c) => sum + (c.shipment! - c.created) / 86400000, 0) / withShipment.length);
      }

      const withBoth = cycles.filter(c => c.shipment && c.delivery);
      if (withBoth.length > 0) {
        avgOrderToDelivery = Math.round(withBoth.reduce((sum, c) => sum + (c.delivery! - c.shipment!) / 86400000, 0) / withBoth.length);
      }

      const withDelivery = cycles.filter(c => c.delivery);
      if (withDelivery.length > 0) {
        avgFullCycle = Math.round(withDelivery.reduce((sum, c) => sum + (c.delivery! - c.created) / 86400000, 0) / withDelivery.length);
      }
    }

    return {
      emergency, priority, planned,
      newRequests, inProgress, inTransit,
      overdue, stale, notPickedUp,
      deliveryToday, overdueShipment,
      unpaid, partiallyPaid, paid,
      completed, completionRate, total: all.length,
      avgCreationToOrder, avgOrderToDelivery, avgFullCycle,
    };
  }, [filteredRequests, today]);

  // Top objects by expenses
  const [expenseObjectFilter, setExpenseObjectFilter] = useState<string>("all");
  
  const objectExpenses = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    filteredRequests.forEach(r => {
      if (!r.amount || r.amount <= 0) return;
      const name = (r as any).object_name || "Без объекта";
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += r.amount;
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredRequests]);

  const filteredObjectExpenses = useMemo(() => {
    if (expenseObjectFilter === "all") return objectExpenses.slice(0, 10);
    return objectExpenses.filter(o => o.name === expenseObjectFilter);
  }, [objectExpenses, expenseObjectFilter]);

  const totalExpenses = useMemo(() => 
    (expenseObjectFilter === "all" ? objectExpenses : filteredObjectExpenses)
      .reduce((sum, o) => sum + o.total, 0), 
    [objectExpenses, filteredObjectExpenses, expenseObjectFilter]
  );

  const calendarRequests = useMemo(() => (requests || []).filter(r => r.delivery_date), [requests]);

  useEffect(() => {
    if (!currentOrgId) navigate("/select-organization");
  }, [currentOrgId, navigate]);

  const handleRequestClick = useCallback((request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback(() => {
    setEditDialogOpen(false);
    setSelectedRequest(null);
    refetch();
  }, [refetch]);

  const isLoading = requestsLoading;

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-5 overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg text-muted-foreground font-medium">Панель управления</h1>
          <CreateRequestDialog>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Новая заявка
            </Button>
          </CreateRequestDialog>
        </div>



        {/* Period filter + Year */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Период:</span>
            {periodOptions.map(opt => (
              <Button
                key={opt.key}
                variant={period === opt.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setPeriod(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year} год</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            {/* Требует внимания */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="transition-colors cursor-pointer hover:border-primary/40" onClick={() => navigate("/requests?status=Новая заявка")}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Новые, не отработаны</p>
                  <p className="mt-1 font-numeric text-[34px] font-semibold leading-none text-foreground">{stats.newRequests}</p>
                  <p className="mt-2 text-sm text-primary">Открыть в реестре →</p>
                </CardContent>
              </Card>
              <Card className="transition-colors cursor-pointer hover:border-primary/40" onClick={() => navigate("/requests?filter=overdue")}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Просрочено</p>
                  <p className="mt-1 font-numeric text-[34px] font-semibold leading-none text-destructive">{stats.overdue}</p>
                  <p className="mt-2 text-sm text-primary">Открыть в реестре →</p>
                </CardContent>
              </Card>
              <Card className="transition-colors cursor-pointer hover:border-primary/40" onClick={() => navigate("/requests?filter=stale")}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Зависло дольше 2 дней</p>
                  <p className="mt-1 font-numeric text-[34px] font-semibold leading-none text-warning">{stats.stale}</p>
                  <p className="mt-2 text-sm text-primary">Открыть в реестре →</p>
                </CardContent>
              </Card>
              <Card className="transition-colors cursor-pointer hover:border-primary/40" onClick={() => navigate("/requests?payment_status=unpaid")}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Ждёт оплаты</p>
                  <p className="mt-1 font-numeric text-[34px] font-semibold leading-none text-foreground">{stats.unpaid}</p>
                  <p className="mt-2 text-sm text-primary">Открыть в реестре →</p>
                </CardContent>
              </Card>
            </div>


            {/* 📦 ТОП ОБЪЕКТОВ ПО РАСХОДАМ */}
            {objectExpenses.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Расходы по объектам
                      <span className="text-sm font-normal text-muted-foreground ml-1 font-numeric">
                        {totalExpenses.toLocaleString("ru-RU")} ₽
                      </span>
                    </CardTitle>
                    <Select value={expenseObjectFilter} onValueChange={setExpenseObjectFilter}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Все объекты" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все объекты</SelectItem>
                        {objectExpenses.map(o => (
                          <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    {filteredObjectExpenses.map((obj, idx) => {
                      const maxTotal = objectExpenses[0]?.total || 1;
                      const pct = Math.round((obj.total / maxTotal) * 100);
                      return (
                        <div key={obj.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground truncate max-w-[60%]">
                              <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                              {obj.name}
                            </span>
                            <span className="font-medium text-foreground whitespace-nowrap font-numeric">
                              {obj.total.toLocaleString("ru-RU")} ₽
                              <span className="text-muted-foreground text-xs ml-1.5">({obj.count} заявок)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Аналитика */}
            {settings.dashboard.showAnalyticsTabs && filteredRequests.length > 0 && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">Обзор</TabsTrigger>
                  <TabsTrigger value="performance" className="text-xs sm:text-sm">Производительность</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <RequestsAnalytics requests={filteredRequests} allRequests={requests || []} onRequestClick={handleRequestClick} />
                </TabsContent>
                <TabsContent value="performance">
                  <ClosureTimeAnalytics requests={filteredRequests as any} />
                </TabsContent>
              </Tabs>
            )}

            <LowStockWidget />

            <MyPlannerTasksWidget />

            {/* Widgets */}
            {filteredRequests.length > 0 && (settings.dashboard.showCalendarWidget || settings.dashboard.showEmergencyWidget) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {settings.dashboard.showCalendarWidget && <CalendarWidget requests={calendarRequests} />}
                {settings.dashboard.showEmergencyWidget && <EmergencyRequestsWidget requests={filteredRequests} onRequestClick={handleRequestClick} />}
              </div>
            )}
          </>
        )}
      </div>

      <CreateRequestDialog>
        <Button className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all z-50" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </CreateRequestDialog>
      <Button
        onClick={() => navigate("/chat")}
        className="fixed bottom-4 sm:bottom-6 right-20 sm:right-24 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
        size="icon"
        variant="secondary"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
      {selectedRequest && (
        <EditRequestDialog request={selectedRequest} open={editDialogOpen} onOpenChange={handleEditDialogClose} />
      )}
    </div>
  );
};

export default Dashboard;
