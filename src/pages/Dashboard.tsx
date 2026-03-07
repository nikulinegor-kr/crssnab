import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, Plus, MessageCircle, Building2, Truck, Users, Package, FileStack } from "lucide-react";
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
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { DashboardWidgetSettings } from "@/components/dashboard/DashboardWidgetSettings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useUserRole } from "@/hooks/useUserRole";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading: requestsLoading, refetch } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const { logoUrl, orgName } = useOrgBranding();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const { settings } = useViewSettings();
  const { isAdmin } = useUserRole();
  
  // Фильтрация заявок по выбранному году
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => {
      if (!r.request_date) return false;
      const requestYear = new Date(r.request_date).getFullYear();
      return requestYear === parseInt(selectedYear);
    });
  }, [requests, selectedYear]);

  // Вычисление статистики для отфильтрованных заявок
  const stats = useMemo(() => {
    if (!filteredRequests.length) return { total: 0, newToday: 0, emergency: 0, completed: 0, deliveriesToday: 0, overdue: 0 };
    
    const today = new Date().toISOString().split("T")[0];
    const newToday = filteredRequests.filter(
      r => r.created_at?.split("T")[0] === today
    ).length;
    
    const emergency = filteredRequests.filter(
      r => r.priority === "Аварийно" && r.status !== "Доставлено"
    ).length;
    
    const completed = filteredRequests.filter(
      r => r.status === "Доставлено"
    ).length;

    const deliveriesToday = filteredRequests.filter(
      r => r.delivery_date?.split("T")[0] === today
    ).length;

    const overdue = filteredRequests.filter(r => {
      if (!r.delivery_date || r.status === "Доставлено") return false;
      return r.delivery_date.split("T")[0] < today;
    }).length;

    return {
      total: filteredRequests.length,
      newToday,
      emergency,
      completed,
      deliveriesToday,
      overdue,
    };
  }, [filteredRequests]);

  // Генерация списка доступных годов
  const availableYears = useMemo(() => {
    if (!requests) return [new Date().getFullYear().toString()];
    const years = new Set(
      requests
        .filter(r => r.request_date)
        .map(r => new Date(r.request_date).getFullYear().toString())
    );
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [requests]);

  // Мемоизация карточек статистики
  const statsCards = useMemo(() => [
    {
      title: "Всего заявок",
      value: stats.total.toString(),
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
      link: "/requests"
    },
    {
      title: "Новые сегодня",
      value: stats.newToday.toString(),
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
      link: "/requests?status=Новая заявка"
    },
    {
      title: "Аварийно",
      value: stats.emergency.toString(),
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10",
      link: "/requests?priority=Аварийно"
    },
    {
      title: "Выполнено",
      value: stats.completed.toString(),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      link: "/requests?status=Доставлено"
    },
  ], [stats]);

  // Мемоизация последних заявок
  const recentRequests = useMemo(() => filteredRequests.slice(0, 3), [filteredRequests]);

  // Мемоизация заявок с датой доставки для календаря (без фильтра по году заявки)
  const calendarRequests = useMemo(() => 
    (requests || []).filter(r => r.delivery_date), 
    [requests]
  );

  const isLoading = requestsLoading;

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
    }
  }, [currentOrgId, navigate]);

  // Обработчики с useCallback
  const handleRequestClick = useCallback((request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  }, []);

  const handleEditDialogClose = useCallback(() => {
    setEditDialogOpen(false);
    setSelectedRequest(null);
    refetch();
  }, [refetch]);

  const handleNavigateToRequests = useCallback(() => {
    navigate("/requests");
  }, [navigate]);

  const handleNavigateToImport = useCallback(() => {
    navigate("/import");
  }, [navigate]);

  const handleNavigateToChat = useCallback(() => {
    navigate("/chat");
  }, [navigate]);

  const handleNavigateToEmergency = useCallback(() => {
    navigate("/requests?priority=Аварийно&status=!Доставлено");
  }, [navigate]);

  const handleStatsCardClick = useCallback((link: string) => {
    navigate(link);
  }, [navigate]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "Доставлено": return "text-success";
      case "Доставлено в ТК": return "text-success";
      case "Выполнено": return "text-success";
      case "В работе": return "text-info";
      case "В пути": return "text-info";
      case "Новая заявка": return "text-accent";
      case "На согласовании": return "text-purple-500";
      case "КП": return "text-purple-500";
      case "Счёт": return "text-orange-500";
      default: return "text-foreground";
    }
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-6 overflow-hidden min-w-0">
        {/* Brand block */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="p-2.5 rounded-lg bg-muted/60 shrink-0">
                <img src={logoUrl} alt={orgName} className="h-[88px] w-[88px] object-contain rounded-lg" style={{ imageRendering: 'auto' }} />
              </div>
            ) : (
              <div className="h-[88px] w-[88px] rounded-lg bg-muted flex items-center justify-center shrink-0 p-2.5">
                <Building2 className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1">
              {orgName && <p className="text-xl font-semibold text-foreground">{orgName}</p>}
              <h1 className="text-xl sm:text-2xl font-bold text-muted-foreground">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <DashboardWidgetSettings />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[140px] md:w-[180px]">
                <SelectValue placeholder="Год" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year} год
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        {settings.dashboard.showStatsCards && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {isLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-card border-border/40 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-5 rounded" />
                    </CardHeader>
                    <CardContent className="pt-2">
                      <Skeleton className="h-8 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              statsCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card 
                    key={stat.title} 
                    className="bg-card border-border/40 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-primary/50"
                    onClick={() => handleStatsCardClick(stat.link)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0 p-3 sm:p-4">
                      <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                    </CardHeader>
                    <CardContent className="pt-1 sm:pt-2 p-3 sm:p-4">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* График расходов для руководства */}
        {isAdmin && settings.dashboard.showExpenseChart && !isLoading && requests && requests.length > 0 && (
          <ExpenseChart requests={requests} selectedYear={selectedYear} />
        )}

        {/* Аналитика с вкладками */}
        {settings.dashboard.showAnalyticsTabs && !isLoading && filteredRequests.length > 0 && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Обзор</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs sm:text-sm">Производительность</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <RequestsAnalytics 
                requests={filteredRequests} 
                allRequests={requests || []}
                onRequestClick={handleRequestClick}
              />
            </TabsContent>
            <TabsContent value="performance">
              <ClosureTimeAnalytics requests={filteredRequests as any} />
            </TabsContent>
          </Tabs>
        )}

        {/* Дополнительные виджеты - вторая линия */}
        {!isLoading && filteredRequests.length > 0 && (settings.dashboard.showCalendarWidget || settings.dashboard.showEmergencyWidget) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {settings.dashboard.showCalendarWidget && (
              <CalendarWidget 
                requests={calendarRequests} 
              />
            )}
            {settings.dashboard.showEmergencyWidget && (
              <EmergencyRequestsWidget 
                requests={filteredRequests} 
                onRequestClick={handleRequestClick}
              />
            )}
          </div>
        )}

        {/* Recent Requests */}
        {settings.dashboard.showRecentRequests && (
          <Card className="bg-card border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Последние заявки</CardTitle>
              <Button onClick={handleNavigateToRequests} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                Все заявки
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border/40 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 rounded-full bg-muted w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">У вас пока нет заявок</h3>
                <p className="text-sm text-muted-foreground mb-4">Начните с импорта данных из Google Sheets</p>
                <Button onClick={handleNavigateToImport} className="gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Импортировать данные
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => handleRequestClick(request)}
                    className="flex items-start gap-3 p-3 border border-border/40 rounded-lg hover:bg-muted/50 hover:border-primary/40 transition-all duration-150 cursor-pointer group"
                  >
                    <div className="p-2 rounded bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground truncate text-sm">
                      {request.description}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {new Date(request.request_date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-md max-w-[120px] truncate shrink-0 ${getStatusColor(request.status)} bg-opacity-10`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(request.request_date).toLocaleDateString("ru-RU")}
                        </span>
                        {request.priority && (
                          <span className="flex items-center gap-1 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            {request.priority}
                          </span>
                        )}
                        {request.applicant && (
                          <span className="truncate">Заявитель: {request.applicant}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      <CreateRequestDialog>
        <Button className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all z-50" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </CreateRequestDialog>
      <Button 
        onClick={handleNavigateToChat}
        className="fixed bottom-4 sm:bottom-6 right-20 sm:right-24 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all z-50" 
        size="icon"
        variant="secondary"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
      {selectedRequest && (
        <EditRequestDialog
          request={selectedRequest}
          open={editDialogOpen}
          onOpenChange={handleEditDialogClose}
        />
      )}
    </div>
  );
};

export default Dashboard;
