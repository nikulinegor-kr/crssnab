import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useRequests, useRequestStats } from "@/hooks/useRequests";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const { data: requests, isLoading: requestsLoading } = useRequests();
  const { data: stats, isLoading: statsLoading } = useRequestStats();

  const statsCards = [
    {
      title: "Всего заявок",
      value: stats?.total.toString() || "0",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Новые сегодня",
      value: stats?.newToday.toString() || "0",
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10"
    },
    {
      title: "Аварийно",
      value: stats?.emergency.toString() || "0",
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      title: "Выполнено",
      value: stats?.completed.toString() || "0",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10"
    },
  ];

  const recentRequests = requests?.slice(0, 5) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Доставлено": return "text-success";
      case "Выполнена": return "text-success";
      case "В работе": return "text-info";
      case "Новая": return "text-accent";
      case "Аварийно": return "text-destructive font-semibold";
      default: return "text-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">KR Заявки</h1>
            <p className="text-muted-foreground mt-1">Система управления заявками отдела снабжения</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/import" className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">
              Импорт данных
            </a>
            <span className="text-sm text-muted-foreground">Иванов Алексей</span>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              ИА
            </div>
          </div>
        </div>

        {/* Stats Grid */}
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
                <Card key={index} className="border-none shadow-card hover:shadow-elevated transition-shadow">
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

        {/* Recent Requests */}
        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Последние заявки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {requestsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Заявок пока нет
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">№ Заявки</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Описание</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Контрагент</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Статус</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Дата заявки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map((request) => (
                      <tr key={request.id} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                        <td className="py-3 px-4 font-mono text-sm text-foreground">{request.request_number}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{request.description}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{request.contractor || "—"}</td>
                        <td className={`py-3 px-4 text-sm ${getStatusColor(request.status)}`}>{request.status}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(request.request_date).toLocaleDateString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-card hover:shadow-elevated transition-all cursor-pointer bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Создать заявку</h3>
                  <p className="text-sm opacity-90 mt-1">Добавить новую заявку в систему</p>
                </div>
                <FileText className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-card hover:shadow-elevated transition-all cursor-pointer bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Все заявки</h3>
                  <p className="text-sm opacity-90 mt-1">Просмотр и управление заявками</p>
                </div>
                <FileText className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
