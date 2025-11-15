import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, Plus, List, Upload, LogOut } from "lucide-react";
import { useRequests, useRequestStats } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading: requestsLoading } = useRequests();
  const { data: stats, isLoading: statsLoading } = useRequestStats();
  const { toast } = useToast();

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

  const recentRequests = requests?.slice(0, 5) || [];

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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">KR Заявки</h1>
            <p className="text-muted-foreground mt-1">Система управления заявками отдела снабжения</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/requests")} variant="outline" size="sm" className="gap-2">
              <List className="h-4 w-4" />
              Все заявки
            </Button>
            <Button onClick={() => navigate("/import")} variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Импорт
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-none shadow-card">
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card 
                  key={index} 
                  className="border-none shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
                  onClick={() => navigate(stat.link)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                        <p className="text-3xl font-bold mt-2 text-foreground">{stat.value}</p>
                      </div>
                      <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="border-none shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Последние заявки</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/requests")}
              className="text-primary hover:text-primary/80"
            >
              Смотреть все →
            </Button>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : recentRequests.length > 0 ? (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border border-border/50 hover:border-border transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {request.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{new Date(request.request_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                          {request.applicant && (
                            <>
                              <span>•</span>
                              <span className="truncate">👤 {request.applicant}</span>
                            </>
                          )}
                          {request.executor && (
                            <>
                              <span>•</span>
                              <span className="truncate">⚙️ {request.executor}</span>
                            </>
                          )}
                          {request.contractor && (
                            <>
                              <span>•</span>
                              <span className="truncate">{request.contractor}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-sm font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                        {request.payment_percentage > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {request.payment_percentage}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Заявок пока нет</p>
                <Button onClick={() => navigate("/import")} variant="outline" size="sm">
                  Импортировать данные
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
