import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, AlertCircle, CheckCircle } from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      title: "Всего заявок",
      value: "156",
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Новые сегодня",
      value: "12",
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10"
    },
    {
      title: "Аварийно",
      value: "3",
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      title: "Выполнено",
      value: "89",
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10"
    },
  ];

  const recentRequests = [
    { id: "REQ-245", client: "ООО Техносервис", priority: "Высокий", status: "В работе", assignee: "Иванов А." },
    { id: "REQ-244", client: "АО Промснаб", priority: "Средний", status: "Новая", assignee: "Петров В." },
    { id: "REQ-243", client: "ИП Козлов", priority: "Низкий", status: "Выполнена", assignee: "Сидоров М." },
    { id: "REQ-242", client: "ООО Стройматериалы", priority: "Аварийно", status: "В работе", assignee: "Иванов А." },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Аварийно": return "text-destructive font-semibold";
      case "Высокий": return "text-accent font-semibold";
      case "Средний": return "text-warning";
      case "Низкий": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Выполнена": return "text-success";
      case "В работе": return "text-info";
      case "Новая": return "text-accent";
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
            <span className="text-sm text-muted-foreground">Иванов Алексей</span>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              ИА
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
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
          })}
        </div>

        {/* Recent Requests */}
        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Последние заявки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">№ Заявки</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Клиент</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Приоритет</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Статус</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Ответственный</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((request, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <td className="py-3 px-4 font-mono text-sm text-foreground">{request.id}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{request.client}</td>
                      <td className={`py-3 px-4 text-sm ${getPriorityColor(request.priority)}`}>{request.priority}</td>
                      <td className={`py-3 px-4 text-sm ${getStatusColor(request.status)}`}>{request.status}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{request.assignee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
