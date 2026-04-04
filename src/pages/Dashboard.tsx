import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, Clock, AlertCircle, Plus, MessageCircle, Building2, Truck, 
  AlertTriangle, DollarSign, CheckCircle, Timer, Pause, PackageCheck,
  TrendingUp, Zap, Star, CalendarDays, PackageX, Ban, BarChart3
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LowStockWidget } from "@/components/dashboard/LowStockWidget";
import { useRequests } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { Request } from "@/hooks/useRequests";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { ClosureTimeAnalytics } from "@/components/analytics/ClosureTimeAnalytics";
import { EmergencyRequestsWidget } from "@/components/dashboard/EmergencyRequestsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { DashboardWidgetSettings } from "@/components/dashboard/DashboardWidgetSettings";
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

interface DashboardCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: "danger" | "warning" | "success" | "info" | "neutral";
  hint?: string;
  onClick?: () => void;
}

const variantStyles: Record<string, { icon: string; border: string; bg: string; text: string }> = {
  danger: { icon: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/10", text: "text-destructive" },
  warning: { icon: "text-orange-500", border: "border-orange-500/30", bg: "bg-orange-500/10", text: "text-orange-500" },
  success: { icon: "text-green-500", border: "border-green-500/30", bg: "bg-green-500/10", text: "text-green-500" },
  info: { icon: "text-blue-500", border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-500" },
  neutral: { icon: "text-muted-foreground", border: "border-border/40", bg: "bg-muted/50", text: "text-foreground" },
};

function DashboardCard({ title, value, icon: Icon, variant = "neutral", hint, onClick }: DashboardCardProps) {
  const s = variantStyles[variant];
  const card = (
    <Card
      className={`${s.border} cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground leading-tight">{title}</p>
          <div className={`p-1.5 rounded-md ${s.bg}`}>
            <Icon className={`h-3.5 w-3.5 ${s.icon}`} />
          </div>
        </div>
        <p className={`text-2xl font-bold ${value > 0 ? s.text : "text-muted-foreground"}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{hint}</p>}
      </CardContent>
    </Card>
  );

  if (hint) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h2>
    </div>
  );
}

const Dashboard = () => {
  const rawNavigate = useNavigate();
  // Clear saved filters before navigating to /requests so dashboard filter is the only active one
  const navigate = useCallback((path: string) => {
    if (path.startsWith("/requests")) {
      localStorage.removeItem("requests_filters");
    }
    rawNavigate(path);
  }, [rawNavigate]);
  const { data: requests, isLoading: requestsLoading, refetch } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const { logoUrl, orgName } = useOrgBranding();
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                <img src={logoUrl} alt={orgName} className="h-16 w-16 object-contain rounded-lg" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              {orgName && <p className="text-lg font-semibold text-foreground">{orgName}</p>}
              <h1 className="text-lg text-muted-foreground font-medium">Панель управления</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DashboardWidgetSettings />
            <CreateRequestDialog>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Новая заявка
              </Button>
            </CreateRequestDialog>
          </div>
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
            {/* 🔴 СРОЧНОСТЬ */}
            <div className="space-y-2">
              <SectionHeader icon={Zap} title="Срочность" color="text-destructive" />
              <div className="grid grid-cols-3 gap-3">
                <DashboardCard title="Аварийные" value={stats.emergency} icon={AlertCircle} variant="danger" onClick={() => navigate("/requests?priority=Аварийно")} />
                <DashboardCard title="Приоритетные" value={stats.priority} icon={Star} variant="warning" onClick={() => navigate("/requests?priority=Приоритетно")} />
                <DashboardCard title="Плановые" value={stats.planned} icon={CalendarDays} variant="info" onClick={() => navigate("/requests?priority=Планово")} />
              </div>
            </div>

            {/* ⚙️ РАБОТА */}
            <div className="space-y-2">
              <SectionHeader icon={FileText} title="Работа" color="text-blue-500" />
              <div className="grid grid-cols-3 gap-3">
                <DashboardCard title="Новые заявки" value={stats.newRequests} icon={Plus} variant="info" onClick={() => navigate("/requests?status=Новая заявка")} />
                <DashboardCard title="В работе" value={stats.inProgress} icon={Timer} variant="neutral" onClick={() => navigate("/requests?status=В работе")} />
                <DashboardCard title="В пути" value={stats.inTransit} icon={Truck} variant="info" onClick={() => navigate("/requests?status=В пути")} />
              </div>
            </div>

            {/* 🚨 ПРОБЛЕМЫ */}
            <div className="space-y-2">
              <SectionHeader icon={AlertTriangle} title="Проблемы" color="text-destructive" />
              <div className="grid grid-cols-3 gap-3">
                <DashboardCard title="Просроченные" value={stats.overdue} icon={Clock} variant="danger" hint="Дата прихода прошла, но заявка не доставлена" onClick={() => navigate("/requests?filter=overdue")} />
                <DashboardCard title="Зависшие (>2 дн.)" value={stats.stale} icon={Pause} variant="danger" hint="Нет изменений более 2 дней" onClick={() => navigate("/requests?filter=stale")} />
                <DashboardCard title="Не забраны из ТК" value={stats.notPickedUp} icon={PackageX} variant="danger" hint="Статус «Доставлено в ТК», но не забраны" onClick={() => navigate("/requests?status=Доставлено в ТК")} />
              </div>
            </div>

            {/* 🚚 ЛОГИСТИКА */}
            <div className="space-y-2">
              <SectionHeader icon={Truck} title="Логистика" color="text-blue-500" />
              <div className="grid grid-cols-3 gap-3">
                <DashboardCard title="В пути" value={stats.inTransit} icon={Truck} variant="info" onClick={() => navigate("/requests?status=В пути")} />
                <DashboardCard title="Доставка сегодня" value={stats.deliveryToday} icon={CalendarDays} variant="success" hint="Дата прихода = сегодня, статус не «Доставлено»" onClick={() => navigate("/requests?filter=deliveryToday")} />
                <DashboardCard title="Просрочка отгрузки" value={stats.overdueShipment} icon={AlertTriangle} variant="danger" hint="Просрочка отгрузки — дата отгрузки прошла, но товар не отправлен" onClick={() => navigate("/requests?filter=overdueShipment")} />
              </div>
            </div>

            {/* 💰 ФИНАНСЫ */}
            <div className="space-y-2">
              <SectionHeader icon={DollarSign} title="Финансы (со счётом)" color="text-green-500" />
              <div className="grid grid-cols-3 gap-3">
                <DashboardCard title="Не оплачено" value={stats.unpaid} icon={Ban} variant="danger" hint="Есть счёт, но оплата не проведена" onClick={() => navigate("/requests?payment_status=unpaid")} />
                <DashboardCard title="Частично оплачено" value={stats.partiallyPaid} icon={DollarSign} variant="warning" hint="Есть счёт, оплата частичная" onClick={() => navigate("/requests?payment_status=partial")} />
                <DashboardCard title="Оплачено" value={stats.paid} icon={CheckCircle} variant="success" hint="Есть счёт, оплата 100%" onClick={() => navigate("/requests?payment_status=paid")} />
              </div>
            </div>

            {/* 📊 ЭФФЕКТИВНОСТЬ + ⏱ СРЕДНЕЕ ВРЕМЯ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <SectionHeader icon={TrendingUp} title="Эффективность" color="text-green-500" />
                <div className="grid grid-cols-2 gap-3">
                  <DashboardCard title="Выполнено" value={stats.completed} icon={PackageCheck} variant="success" onClick={() => navigate("/requests?status=Доставлено")} />
                  <Card className="border-border/40 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/requests")}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">% выполнения</p>
                        <div className="p-1.5 rounded-md bg-green-500/10">
                          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                        </div>
                      </div>
                      <p className={`text-2xl font-bold ${stats.completionRate >= 70 ? "text-green-500" : stats.completionRate >= 40 ? "text-orange-500" : "text-destructive"}`}>
                        {stats.completionRate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">{stats.completed} из {stats.total}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="space-y-2">
                <SectionHeader icon={Timer} title="Среднее время (дней)" color="text-blue-500" />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { title: "Создание → Заказ", value: stats.avgCreationToOrder, hint: "От создания заявки до отгрузки" },
                    { title: "Заказ → Доставка", value: stats.avgOrderToDelivery, hint: "От отгрузки до прихода" },
                    { title: "Полный цикл", value: stats.avgFullCycle, hint: "От создания до доставки" },
                  ].map(item => (
                    <TooltipProvider key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card className="border-border/40">
                            <CardContent className="p-4">
                              <p className="text-xs text-muted-foreground mb-2 leading-tight">{item.title}</p>
                              <p className={`text-2xl font-bold ${item.value > 14 ? "text-destructive" : item.value > 7 ? "text-orange-500" : "text-green-500"}`}>
                                {item.value || "—"}
                              </p>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">{item.hint}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </div>

            {/* 📦 ТОП ОБЪЕКТОВ ПО РАСХОДАМ */}
            {objectExpenses.length > 0 && (
              <Card className="border-border/40">
                <CardHeader className="pb-3 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Расходы по объектам
                      <span className="text-sm font-normal text-muted-foreground ml-1">
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
                            <span className="font-medium text-foreground whitespace-nowrap">
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
