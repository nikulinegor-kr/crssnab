import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import type { Request } from "@/hooks/useRequests";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { EmergencyRequestsWidget } from "@/components/dashboard/EmergencyRequestsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { useDemoData } from "@/hooks/useDemoData";
import { DemoBanner } from "@/components/DemoBanner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const Demo = () => {
  const navigate = useNavigate();
  const demoData = useDemoData();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const requests = demoData.requests;
  const stats = demoData.stats;

  const statsCards = [
    {
      title: "Всего заявок",
      value: stats.total.toString(),
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Новые сегодня",
      value: stats.newToday.toString(),
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Аварийно",
      value: stats.emergency.toString(),
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Выполнено",
      value: stats.completed.toString(),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const recentRequests = requests?.slice(0, 5) || [];

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Доставлено":
      case "Доставлено в ТК":
      case "Выполнено":
        return "bg-success/10 text-success hover:bg-success/20";
      case "В работе":
        return "bg-info/10 text-info hover:bg-info/20";
      case "На согласовании":
      case "КП":
        return "bg-warning/10 text-warning hover:bg-warning/20";
      case "Новая заявка":
        return "bg-primary/10 text-primary hover:bg-primary/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string | null) => {
    if (priority === "Аварийно") {
      return "bg-accent/10 text-accent hover:bg-accent/20";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <DemoBanner />
        
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Демонстрация системы</h1>
            <p className="text-muted-foreground mt-2">
              Обзор функционала системы управления заявками
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Analytics and Widgets */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <RequestsAnalytics requests={requests} />
              <EmergencyRequestsWidget 
                requests={requests} 
                onRequestClick={handleRequestClick}
              />
            </div>
            <div>
              <CalendarWidget requests={requests} />
            </div>
          </div>

          {/* Recent Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Последние заявки</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Нажмите на заявку для просмотра деталей
                </p>
              </div>
              <Button onClick={() => navigate("/auth")} variant="outline">
                Все заявки
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => handleRequestClick(request)}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-sm">
                          #{request.request_number}
                        </span>
                        <Badge variant="outline" className={getStatusBadgeColor(request.status)}>
                          {request.status}
                        </Badge>
                        {request.priority === "Аварийно" && (
                          <Badge variant="outline" className={getPriorityColor(request.priority)}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {request.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {request.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {request.request_date && (
                          <span>
                            {format(new Date(request.request_date), "d MMM yyyy", { locale: ru })}
                          </span>
                        )}
                        {request.executor && (
                          <span>Исполнитель: {request.executor}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedRequest && (
          <EditRequestDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                handleEditDialogClose();
              }
            }}
            request={selectedRequest}
          />
        )}
      </div>
    </div>
  );
};

export default Demo;
