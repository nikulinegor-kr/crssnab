import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { 
  Edit, 
  Download, 
  FileImage, 
  FileText,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { EditRequestDialog } from "@/components/EditRequestDialog";

interface ActivityItem {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  description?: string;
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit } = useUserRole();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Request;
    },
    enabled: !!id,
  });

  const getPriorityColor = (priority: string): "default" | "destructive" | "outline" | "secondary" => {
    const colors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      "Аварийно": "destructive",
      "Высокий": "default",
      "Средний": "secondary",
      "Низкий": "outline"
    };
    return colors[priority] || "default";
  };

  const getStatusColor = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    const colors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      "Доставлено": "default",
      "В работе": "secondary",
      "Новая": "outline"
    };
    return colors[status] || "default";
  };

  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      toast({
        title: "Комментарий добавлен",
        description: "Ваш комментарий успешно отправлен",
      });
      setComment("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить комментарий",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-12 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-6">
        <div className="max-w-7xl mx-auto">
          <Button onClick={() => navigate("/requests")} variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
          <p className="text-muted-foreground">Заявка не найдена</p>
        </div>
      </div>
    );
  }

  const mockActivities: ActivityItem[] = [
    {
      id: "1",
      action: 'Статус изменён на "В работе"',
      user: "Сергей Новиков",
      timestamp: "24.07.2024, 10:30",
      description: "Принял заявку, начинаю диагностику проблемы на сервере."
    },
    {
      id: "2",
      action: "Заявка создана",
      user: request.applicant || "Анна Воронцова",
      timestamp: format(new Date(request.created_at || Date.now()), "dd.MM.yyyy, HH:mm", { locale: ru })
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-4 md:p-6">
      <EditRequestDialog 
        request={request}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button 
            onClick={() => navigate("/requests")}
            className="hover:text-foreground transition-colors"
          >
            Заявки
          </button>
          <span>/</span>
          <span>Список</span>
          <span>/</span>
          <span className="text-foreground">#{request.request_number}</span>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Заявка #{request.request_number}: {request.description}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Создано: {format(new Date(request.created_at || Date.now()), "dd.MM.yyyy, HH:mm", { locale: ru })}</span>
                <span>•</span>
                <span>Автор: {request.applicant || "—"}</span>
                <span>•</span>
                <span>Приоритет: <Badge variant={getPriorityColor(request.priority || "")} className="ml-1">{request.priority}</Badge></span>
              </div>
            </div>
            {canEdit && (
              <Button onClick={handleEditClick} variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                Редактировать
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Детали заявки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Дата заявки</p>
                    <p className="text-sm font-medium">
                      {format(new Date(request.request_date), "dd.MM.yyyy", { locale: ru })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Статус</p>
                    <Badge variant={getStatusColor(request.status)}>{request.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Приоритет</p>
                    <Badge variant={getPriorityColor(request.priority || "")}>{request.priority}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Заявитель</p>
                    <p className="text-sm font-medium">{request.applicant || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Исполнитель</p>
                    <p className="text-sm font-medium">{request.executor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Наличие/срок поставки</p>
                    <p className="text-sm font-medium">{request.availability_delivery_time || "—"}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Описание</p>
                  <p className="text-sm leading-relaxed">{request.description}</p>
                </div>
                {request.comments && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Комментарий</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{request.comments}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Финансовая информация</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Контрагент</p>
                    <p className="text-sm font-medium">{request.contractor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Номер счета</p>
                    <p className="text-sm font-medium">{request.invoice_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Сумма</p>
                    <p className="text-sm font-medium">{request.amount?.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">% оплаты</p>
                    <p className="text-sm font-medium">{request.payment_percentage}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Information */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Информация о доставке</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Дата отгрузки</p>
                    <p className="text-sm font-medium">
                      {request.shipment_date 
                        ? format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })
                        : "—"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Дата доставки</p>
                    <p className="text-sm font-medium">
                      {request.delivery_date 
                        ? format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })
                        : "—"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Транспортная компания</p>
                    <p className="text-sm font-medium">{request.transport_company || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Номер ТТН</p>
                    <p className="text-sm font-medium">{request.waybill_number || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attached Files */}
            <Card className="glassmorphism border-border/40">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Прикреплённые файлы ({(request.photo_url ? 1 : 0) + (request.document_url ? 1 : 0)})
                </CardTitle>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Загрузить
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {request.photo_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                      <div className="p-2 rounded bg-primary/10">
                        <FileImage className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Фото заявки</p>
                        <p className="text-xs text-muted-foreground">1.2 MB</p>
                      </div>
                    </div>
                  )}
                  {request.document_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                      <div className="p-2 rounded bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Документ</p>
                        <p className="text-xs text-muted-foreground">45 KB</p>
                      </div>
                    </div>
                  )}
                  {!request.photo_url && !request.document_url && (
                    <p className="text-sm text-muted-foreground col-span-2">Файлы не прикреплены</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Лента активности</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="relative">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                      {index < mockActivities.length - 1 && (
                        <div className="absolute left-1 top-4 bottom-0 w-[1px] bg-border"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.user} • {activity.timestamp}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                <Separator className="my-4" />
                
                {/* Comment Input */}
                <div className="space-y-3">
                  <Textarea
                    placeholder="Добавить комментарий..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[100px] bg-background/50"
                  />
                  <Button 
                    onClick={handleSubmitComment}
                    disabled={!comment.trim() || isSubmitting}
                    className="w-full"
                  >
                    Отправить комментарий
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Status and Priority */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Статус и Приоритет</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Текущий статус</p>
                  <Badge variant={getStatusColor(request.status)} className="w-full justify-center py-2">
                    {request.status}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Приоритет</p>
                  <Badge variant={getPriorityColor(request.priority || "")} className="w-full justify-center py-2">
                    {request.priority}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Executor */}
            {request.executor && (
              <Card className="glassmorphism border-border/40">
                <CardHeader>
                  <CardTitle className="text-lg">Исполнитель</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {request.executor.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{request.executor}</p>
                      <p className="text-xs text-muted-foreground">Исполнитель</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Dates */}
            <Card className="glassmorphism border-border/40">
              <CardHeader>
                <CardTitle className="text-lg">Ключевые даты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Дата заявки</span>
                  <span className="text-sm font-medium">
                    {format(new Date(request.request_date), "dd.MM.yyyy", { locale: ru })}
                  </span>
                </div>
                {request.shipment_date && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Дата отгрузки</span>
                      <span className="text-sm font-medium">
                        {format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })}
                      </span>
                    </div>
                  </>
                )}
                {request.delivery_date && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Дата доставки</span>
                      <span className="text-sm font-medium">
                        {format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })}
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Создано</span>
                  <span className="text-sm font-medium">
                    {format(new Date(request.created_at || Date.now()), "dd.MM.yyyy, HH:mm", { locale: ru })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
