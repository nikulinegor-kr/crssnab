import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, Plus, List, Upload, LogOut, Users } from "lucide-react";
import { useRequests, useRequestStats } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useEffect, useState } from "react";
import type { Request } from "@/hooks/useRequests";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading: requestsLoading, refetch } = useRequests();
  const { data: stats, isLoading: statsLoading } = useRequestStats();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
    }
  }, [currentOrgId, navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const statsCards = [
    {
      title: "Всего заявок",
      value: stats?.total.toString() || "0",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
      link: "/requests"
    },
    {
      title: "Новые сегодня",
      value: stats?.newToday.toString() || "0",
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
      link: "/requests?status=Новая заявка"
    },
    {
      title: "Аварийно",
      value: stats?.emergency.toString() || "0",
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10",
      link: "/requests?priority=Аварийно"
    },
    {
      title: "Выполнено",
      value: stats?.completed.toString() || "0",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      link: "/requests?status=Выполнено"
    },
  ];

  const recentRequests = requests?.slice(0, 10) || [];

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border/50">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              CRSS
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Система Управления Поставками Компании</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <OrganizationSwitcher />
            <Button onClick={() => navigate("/requests")} variant="outline" size="sm" className="gap-2">
              <List className="h-4 w-4" />
              Все заявки
            </Button>
            <Button onClick={() => navigate("/import")} variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Импорт
            </Button>
            <Button onClick={() => navigate("/manage-users")} variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              Пользователи
            </Button>
            <CreateRequestDialog>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Создать
              </Button>
            </CreateRequestDialog>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              Выход
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-10 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-16" />
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
                  className="hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 hover:-translate-y-1 bg-card/80 backdrop-blur-sm"
                  onClick={() => navigate(stat.link)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-3 rounded-lg ${stat.bgColor} shadow-sm`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold tracking-tight">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Recent Requests */}
        <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">Последние заявки</CardTitle>
              <Button onClick={() => navigate("/requests")} variant="ghost" size="sm" className="gap-2">
                Все заявки
                <List className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {requestsLoading ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border border-border/50 rounded-xl">
                    <Skeleton className="h-14 w-14 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 rounded-full bg-muted/30 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">У вас пока нет заявок</h3>
                <p className="text-muted-foreground mb-6">Начните с импорта данных из Google Sheets</p>
                <Button onClick={() => navigate("/import")} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Импортировать данные
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => handleRequestClick(request)}
                    className="flex items-start gap-4 p-4 border border-border/50 rounded-xl hover:bg-muted/30 hover:border-primary/30 transition-all duration-200 cursor-pointer group hover:shadow-md"
                  >
                    <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground truncate text-lg">
                            {request.request_number}
                          </p>
                          <p className="text-sm text-muted-foreground truncate mt-1.5">
                            {request.description}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shadow-sm ${getStatusColor(request.status)} bg-opacity-10`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(request.request_date).toLocaleDateString("ru-RU")}
                        </span>
                        {request.priority && (
                          <span className="flex items-center gap-1.5 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" />
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
        <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl transition-all" size="icon">
          <Plus className="h-6 w-6" />
        </Button>
      </CreateRequestDialog>
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
