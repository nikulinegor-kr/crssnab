import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, Plus, MessageCircle } from "lucide-react";
import { useRequests } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useEffect, useState, useMemo } from "react";
import type { Request } from "@/hooks/useRequests";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { EmergencyRequestsWidget } from "@/components/dashboard/EmergencyRequestsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading: requestsLoading, refetch } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
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
    if (!filteredRequests.length) return { total: 0, newToday: 0, emergency: 0, completed: 0 };
    
    const today = new Date().toISOString().split("T")[0];
    const newToday = filteredRequests.filter(
      r => r.created_at?.split("T")[0] === today
    ).length;
    
    const emergency = filteredRequests.filter(
      r => r.priority === "Аварийно"
    ).length;
    
    const completed = filteredRequests.filter(
      r => r.status === "Доставлено"
    ).length;

    return {
      total: filteredRequests.length,
      newToday,
      emergency,
      completed,
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

  const isLoading = requestsLoading;

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
    }
  }, [currentOrgId, navigate]);

  const statsCards = [
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
  ];

  const recentRequests = filteredRequests.slice(0, 3);

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedRequest(null);
    refetch();
  };

  const getStatusColor = (status: string) => {
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
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header with Year Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Выберите год" />
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

        {/* Stats Cards */}
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
                  onClick={() => navigate(stat.link)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Аналитика */}
        {!isLoading && filteredRequests.length > 0 && (
          <RequestsAnalytics 
            requests={filteredRequests} 
            onEmergencyClick={() => navigate("/requests?priority=Аварийно&status=!Доставлено")}
          />
        )}

        {/* Дополнительные виджеты - вторая линия */}
        {!isLoading && filteredRequests.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CalendarWidget 
              requests={filteredRequests.filter(r => r.delivery_date)} 
            />
            <EmergencyRequestsWidget 
              requests={filteredRequests} 
              onRequestClick={handleRequestClick}
            />
          </div>
        )}

        {/* Recent Requests */}
        <Card className="bg-card border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Последние заявки</CardTitle>
              <Button onClick={() => navigate("/requests")} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
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
                <Button onClick={() => navigate("/import")} className="gap-2" size="sm">
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
                            {request.request_number}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {request.description}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${getStatusColor(request.status)} bg-opacity-10`}>
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
      </div>
      <CreateRequestDialog>
        <Button className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </CreateRequestDialog>
      <Button 
        onClick={() => navigate("/chat")}
        className="fixed bottom-6 right-24 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all" 
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
