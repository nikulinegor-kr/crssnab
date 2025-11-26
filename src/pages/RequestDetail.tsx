import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  FileImage, 
  FileText,
  Eye,
  CalendarIcon,
  Upload,
  X,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { ImageViewer } from "@/components/ImageViewer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

interface Activity {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  user_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useUserRole();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  // Fetch statuses and priorities
  const { data: statuses } = useQuery({
    queryKey: ["request-statuses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_statuses")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: priorities } = useQuery({
    queryKey: ["request-priorities", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_priorities")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch activities
  const { data: activities } = useQuery({
    queryKey: ["request-activities", id],
    queryFn: async () => {
      const { data: activitiesData, error } = await supabase
        .from("request_activities")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(activitiesData?.map(a => a.user_id).filter(Boolean) || [])];
      
      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Map profiles to activities
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return activitiesData?.map(activity => ({
        ...activity,
        profiles: activity.user_id ? profilesMap.get(activity.user_id) : null
      })) as Activity[];
    },
    enabled: !!id,
  });

  // Mutation for updating request fields
  const updateRequestMutation = useMutation({
    mutationFn: async (updates: Partial<Request>) => {
      const { data, error } = await supabase
        .from("requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["request-activities", id] });
      toast({
        title: "Успешно",
        description: "Заявка обновлена",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить заявку",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

  // Mutation for archiving request
  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("requests")
        .update({ archived: true })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Заявка перемещена в архив",
      });
      navigate("/requests");
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось переместить заявку в архив",
        variant: "destructive",
      });
      console.error("Archive error:", error);
    },
  });

  // File upload handlers
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("request-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("request-photos")
        .getPublicUrl(filePath);

      await updateRequestMutation.mutateAsync({ photo_url: publicUrl });
    } catch (error) {
      console.error("Photo upload error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить фото",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingDoc(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("request-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("request-documents")
        .getPublicUrl(filePath);

      await updateRequestMutation.mutateAsync({ document_url: publicUrl });
    } catch (error) {
      console.error("Document upload error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить документ",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDoc(false);
    }
  };

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

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
    setImageViewerOpen(true);
  };

  const handleBackClick = () => {
    navigate("/requests");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-4 md:p-6">
      <EditRequestDialog 
        request={request}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <ImageViewer
        imageUrl={selectedImage}
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back button */}
        <Button 
          onClick={handleBackClick} 
          variant="ghost" 
          className="gap-2 h-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к заявкам
        </Button>

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
          <span className="text-foreground">#{request.description}</span>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Заявка: {request.description}
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
                    {canEdit ? (
                      <Select
                        value={request.status}
                        onValueChange={(value) => updateRequestMutation.mutate({ status: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses?.map((status) => (
                            <SelectItem key={status.id} value={status.name}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getStatusColor(request.status)}>{request.status}</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Приоритет</p>
                    {canEdit ? (
                      <Select
                        value={request.priority || ""}
                        onValueChange={(value) => updateRequestMutation.mutate({ priority: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities?.map((priority) => (
                            <SelectItem key={priority.id} value={priority.name}>
                              {priority.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getPriorityColor(request.priority || "")}>{request.priority}</Badge>
                    )}
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
                    {canEdit ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-9",
                              !request.shipment_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {request.shipment_date
                              ? format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })
                              : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={request.shipment_date ? new Date(request.shipment_date) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                updateRequestMutation.mutate({ 
                                  shipment_date: format(date, "yyyy-MM-dd") 
                                });
                              }
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-sm font-medium">
                        {request.shipment_date 
                          ? format(new Date(request.shipment_date), "dd.MM.yyyy", { locale: ru })
                          : "—"
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Дата доставки</p>
                    {canEdit ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-9",
                              !request.delivery_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {request.delivery_date
                              ? format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })
                              : "Выберите дату"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={request.delivery_date ? new Date(request.delivery_date) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                updateRequestMutation.mutate({ 
                                  delivery_date: format(date, "yyyy-MM-dd") 
                                });
                              }
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-sm font-medium">
                        {request.delivery_date 
                          ? format(new Date(request.delivery_date), "dd.MM.yyyy", { locale: ru })
                          : "—"
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Транспортная компания</p>
                    {canEdit ? (
                      <Input
                        value={request.transport_company || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateRequestMutation.mutate({ transport_company: value || null });
                        }}
                        placeholder="Введите название ТК"
                        className="h-9"
                      />
                    ) : (
                      <p className="text-sm font-medium">{request.transport_company || "—"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Номер ТТН</p>
                    {canEdit ? (
                      <Input
                        value={request.waybill_number || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateRequestMutation.mutate({ waybill_number: value || null });
                        }}
                        placeholder="Введите номер ТТН"
                        className="h-9"
                      />
                    ) : (
                      <p className="text-sm font-medium">{request.waybill_number || "—"}</p>
                    )}
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
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" disabled={isUploadingPhoto} asChild>
                      <label>
                        <Upload className="h-4 w-4" />
                        {isUploadingPhoto ? "Загрузка..." : "Фото"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          disabled={isUploadingPhoto}
                        />
                      </label>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" disabled={isUploadingDoc} asChild>
                      <label>
                        <Upload className="h-4 w-4" />
                        {isUploadingDoc ? "Загрузка..." : "Документ"}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          onChange={handleDocumentUpload}
                          className="hidden"
                          disabled={isUploadingDoc}
                        />
                      </label>
                    </Button>
                  </div>
                )}
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
                        <div className="flex gap-2 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => handleImageClick(request.photo_url!)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Просмотр
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3"
                            asChild
                          >
                            <a href={request.photo_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-1" />
                              Скачать
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {request.document_url && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                      <div className="p-2 rounded bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Документ (Счёт/КП)</p>
                        <div className="flex gap-2 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3"
                            onClick={async () => {
                              // Открываем окно СРАЗУ (синхронно) чтобы избежать блокировки на мобильных
                              const newWindow = window.open('', '_blank');
                              
                              try {
                                const url = new URL(request.document_url!);
                                const pathParts = url.pathname.split('/');
                                const bucketIndex = pathParts.findIndex(p => p === 'request-documents');
                                
                                if (bucketIndex === -1 || !newWindow) {
                                  if (newWindow) newWindow.close();
                                  window.open(request.document_url!, '_blank');
                                  return;
                                }
                                
                                const filePath = pathParts.slice(bucketIndex + 1).join('/');
                                const { data, error } = await supabase.storage
                                  .from('request-documents')
                                  .createSignedUrl(filePath, 3600);
                                
                                if (error || !data?.signedUrl) {
                                  console.error('Error creating signed URL:', error);
                                  newWindow.location.href = request.document_url!;
                                  return;
                                }
                                
                                // Обновляем URL открытого окна
                                newWindow.location.href = data.signedUrl;
                              } catch (error) {
                                console.error('Error opening document:', error);
                                if (newWindow) {
                                  newWindow.location.href = request.document_url!;
                                }
                              }
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Просмотр
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3"
                            onClick={async () => {
                              try {
                                const url = new URL(request.document_url!);
                                const pathParts = url.pathname.split('/');
                                const bucketIndex = pathParts.findIndex(p => p === 'request-documents');
                                
                                if (bucketIndex === -1) {
                                  // Для не-Supabase URL просто открываем в новой вкладке
                                  window.open(request.document_url!, '_blank');
                                  return;
                                }
                                
                                const filePath = pathParts.slice(bucketIndex + 1).join('/');
                                const fileName = filePath.split('/').pop() || 'document.pdf';
                                
                                // Получаем signed URL
                                const { data, error } = await supabase.storage
                                  .from('request-documents')
                                  .createSignedUrl(filePath, 60);
                                
                                if (error || !data?.signedUrl) {
                                  console.error('Error creating signed URL:', error);
                                  window.open(request.document_url!, '_blank');
                                  return;
                                }
                                
                                // Используем простой подход с ссылкой и download атрибутом
                                const link = document.createElement('a');
                                link.href = data.signedUrl;
                                link.download = fileName;
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                
                                // Удаляем ссылку через небольшую задержку
                                setTimeout(() => {
                                  document.body.removeChild(link);
                                }, 100);
                              } catch (error) {
                                console.error('Error downloading document:', error);
                                window.open(request.document_url!, '_blank');
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Скачать
                          </Button>
                        </div>
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
                {activities && activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="relative">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2"></div>
                        {index < activities.length - 1 && (
                          <div className="absolute left-1 top-4 bottom-0 w-[1px] bg-border"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.profiles?.full_name || activity.profiles?.email || "Система"} • {format(new Date(activity.created_at), "dd.MM.yyyy, HH:mm", { locale: ru })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">История действий пока пуста</p>
                )}
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
                  {canEdit ? (
                    <Select
                      value={request.status}
                      onValueChange={(value) => updateRequestMutation.mutate({ status: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses?.map((status) => (
                          <SelectItem key={status.id} value={status.name}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getStatusColor(request.status)} className="w-full justify-center py-2">
                      {request.status}
                    </Badge>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Приоритет</p>
                  {canEdit ? (
                    <Select
                      value={request.priority || ""}
                      onValueChange={(value) => updateRequestMutation.mutate({ priority: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities?.map((priority) => (
                          <SelectItem key={priority.id} value={priority.name}>
                            {priority.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getPriorityColor(request.priority || "")} className="w-full justify-center py-2">
                      {request.priority}
                    </Badge>
                  )}
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

            {/* Archive Request */}
            {canEdit && (
              <Card className="glassmorphism border-border/40 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">Архивация</CardTitle>
                </CardHeader>
                <CardContent>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2">
                        <Trash2 className="h-4 w-4" />
                        Переместить в архив
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Переместить в архив?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Заявка #{request.request_number} будет перемещена в архив и не будет отображаться в основном списке.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteRequestMutation.mutate()}
                          className="bg-primary hover:bg-primary/90"
                        >
                          В архив
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
