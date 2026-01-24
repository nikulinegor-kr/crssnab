import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Request } from "@/hooks/useRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  FileImage, 
  FileText,
  Eye,
  Upload,
  X,
  Trash2,
  Send,
  Loader2,
  Copy,
  User,
  Building2,
  Receipt,
  CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useState, useRef, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { ImageGallery } from "@/components/ImageGallery";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { notifyTelegram } from "@/lib/telegram";
import { RequestStickyHeader } from "@/components/request/RequestStickyHeader";
import { RequestLogisticsCard } from "@/components/request/RequestLogisticsCard";
import { RequestActivityFeed } from "@/components/request/RequestActivityFeed";
import { RequestQuickActionsCard } from "@/components/request/RequestQuickActionsCard";
import { RequestContextBlock } from "@/components/request/RequestContextBlock";

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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { data: activities } = useQuery({
    queryKey: ["request-activities", id],
    queryFn: async () => {
      const { data: activitiesData, error } = await supabase
        .from("request_activities")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(activitiesData?.map(a => a.user_id).filter(Boolean) || [])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return activitiesData?.map(activity => ({
        ...activity,
        profiles: activity.user_id ? profilesMap.get(activity.user_id) : null
      })) as Activity[];
    },
    enabled: !!id,
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
    onMutate: () => {
      setIsSaving(true);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["request-activities", id] });
      
      // Show "saved" state for 2 seconds after success
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaving(false);
      }, 1500);
    },
    onError: (error) => {
      setIsSaving(false);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить заявку",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

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

  const handleUpdate = (updates: Partial<Request>) => {
    updateRequestMutation.mutate(updates);
  };

  const sanitizeFilename = (filename: string): string => {
    const extension = filename.split('.').pop() || '';
    const sanitized = filename
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
    
    if (!sanitized || sanitized === `.${extension}`) {
      return `file_${Date.now()}.${extension}`;
    }
    return sanitized;
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id || !request) return;

    setIsUploadingPhoto(true);
    try {
      const newUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const sanitizedName = sanitizeFilename(file.name);
        const fileName = `${id}-${Date.now()}-${sanitizedName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("request-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("request-photos")
          .getPublicUrl(fileName);
          
        newUrls.push(publicUrl);
      }

      const existingUrls = request.photo_urls || [];
      await updateRequestMutation.mutateAsync({ 
        photo_urls: [...existingUrls, ...newUrls]
      });
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
    const files = event.target.files;
    if (!files || files.length === 0 || !id || !request) return;

    setIsUploadingDoc(true);
    try {
      const newUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const sanitizedName = sanitizeFilename(file.name);
        const fileName = `${id}-${Date.now()}-${sanitizedName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("request-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("request-documents")
          .getPublicUrl(fileName);
          
        newUrls.push(publicUrl);
      }

      const existingUrls = request.document_urls || [];
      await updateRequestMutation.mutateAsync({ 
        document_urls: [...existingUrls, ...newUrls]
      });
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

  const allPhotos: string[] = [
    ...(request?.photo_urls || []),
    ...(request?.photo_url && !request?.photo_urls?.includes(request.photo_url) ? [request.photo_url] : [])
  ].filter(Boolean);

  const allDocuments: string[] = [
    ...(request?.document_urls || []),
    ...(request?.document_url && !request?.document_urls?.includes(request.document_url) ? [request.document_url] : [])
  ].filter(Boolean);

  const handleImageClick = (index: number) => {
    setGalleryInitialIndex(index);
    setGalleryOpen(true);
  };

  const handleDeletePhoto = async (urlToDelete: string) => {
    if (!request) return;
    
    try {
      const updatedUrls = (request.photo_urls || []).filter(url => url !== urlToDelete);
      const updatedPhotoUrl = request.photo_url === urlToDelete ? null : request.photo_url;
      
      await updateRequestMutation.mutateAsync({ 
        photo_urls: updatedUrls,
        photo_url: updatedPhotoUrl
      });
      
      toast({
        title: "Успешно",
        description: "Фото удалено",
      });
    } catch (error) {
      console.error("Delete photo error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить фото",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (urlToDelete: string) => {
    if (!request) return;
    
    try {
      const updatedUrls = (request.document_urls || []).filter(url => url !== urlToDelete);
      const updatedDocUrl = request.document_url === urlToDelete ? null : request.document_url;
      
      await updateRequestMutation.mutateAsync({ 
        document_urls: updatedUrls,
        document_url: updatedDocUrl
      });
      
      toast({
        title: "Успешно",
        description: "Документ удалён",
      });
    } catch (error) {
      console.error("Delete document error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить документ",
        variant: "destructive",
      });
    }
  };

  const handleSendTelegram = async () => {
    if (!id) return;
    
    setIsSendingTelegram(true);
    try {
      const success = await notifyTelegram(id);
      if (success) {
        toast({
          title: "Успешно",
          description: "Уведомление отправлено в Telegram",
        });
      }
    } catch (error) {
      console.error("Error sending telegram:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить уведомление",
        variant: "destructive",
      });
    } finally {
      setIsSendingTelegram(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-4 md:p-6">
      <EditRequestDialog 
        request={request}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <CreateRequestDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        initialData={{
          description: request.description,
          status: request.status,
          priority: request.priority || undefined,
          applicant: request.applicant || undefined,
          executor: request.executor || undefined,
          object_id: request.object_id || undefined,
          estimated_delivery_days: request.estimated_delivery_days,
          availability_delivery_time: request.availability_delivery_time || undefined,
          contractor: request.contractor || undefined,
          transport_company: request.transport_company || undefined,
          comments: request.comments || undefined,
        }}
      >
        <span />
      </CreateRequestDialog>
      
      <ImageGallery
        images={allPhotos}
        initialIndex={galleryInitialIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
      
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Back button */}
        <Button 
          onClick={() => navigate("/requests")} 
          variant="ghost" 
          className="gap-2 h-10 hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к заявкам
        </Button>

        {/* Sticky Header - Always visible */}
        <RequestStickyHeader
          requestNumber={request.request_number || request.description}
          status={request.status}
          priority={request.priority}
          shipmentDate={request.shipment_date}
          deliveryDate={request.delivery_date}
          isSaving={isSaving || updateRequestMutation.isPending}
        />

        {/* Header with actions */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pt-2">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {request.description}
            </h1>
            <p className="text-sm text-muted-foreground">
              Создано: {format(new Date(request.created_at || Date.now()), "dd.MM.yyyy, HH:mm", { locale: ru })}
              {request.applicant && ` • ${request.applicant}`}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditDialogOpen(true)} variant="outline" size="sm" className="gap-2">
                <Edit className="h-4 w-4" />
                Редактировать
              </Button>
              <Button onClick={() => setCopyDialogOpen(true)} variant="outline" size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                Копировать
              </Button>
              <Button 
                onClick={handleSendTelegram} 
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isSendingTelegram}
              >
                {isSendingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Telegram
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Frequently edited content at top */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Context Block (Description + Comment) - Primary info at top */}
            <RequestContextBlock
              description={request.description}
              comments={request.comments}
              canEdit={canEdit}
              onUpdate={(updates) => handleUpdate(updates)}
            />

            {/* 2. Logistics Block - Unified */}
            <RequestLogisticsCard
              request={request}
              canEdit={canEdit}
              onUpdate={handleUpdate}
            />


            {/* 4. Financial Information */}
            <Card className="glassmorphism border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Финансы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Контрагент</p>
                    <p className="text-sm font-medium truncate">{request.contractor || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">№ счета</p>
                    <p className="text-sm font-medium truncate">{request.invoice_number || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Сумма</p>
                    <p className="text-sm font-medium">{request.amount?.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Оплата</p>
                    <p className="text-sm font-medium">{request.payment_percentage}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5. Attached Files */}
            <Card className="glassmorphism border-border/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-primary" />
                    Файлы ({allPhotos.length + allDocuments.length})
                  </CardTitle>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="gap-1 h-8" disabled={isUploadingPhoto} asChild>
                        <label className="cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-xs">{isUploadingPhoto ? "..." : "Фото"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                            disabled={isUploadingPhoto}
                          />
                        </label>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 h-8" disabled={isUploadingDoc} asChild>
                        <label className="cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-xs">{isUploadingDoc ? "..." : "Документ"}</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            onChange={handleDocumentUpload}
                            className="hidden"
                            disabled={isUploadingDoc}
                          />
                        </label>
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allPhotos.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Фото ({allPhotos.length})</p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {allPhotos.map((url, index) => (
                          <div
                            key={index}
                            className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-all duration-150 group"
                          >
                            <button
                              onClick={() => handleImageClick(index)}
                              className="w-full h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                              <img
                                src={url}
                                alt={`Фото ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(url);
                                }}
                                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {allDocuments.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Документы ({allDocuments.length})</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allDocuments.map((url, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card group hover:bg-muted/30 transition-colors">
                            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">Документ {index + 1}</p>
                              <div className="flex gap-1 mt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={async () => {
                                    const newWindow = window.open('', '_blank');
                                    try {
                                      const docUrl = new URL(url);
                                      const pathParts = docUrl.pathname.split('/');
                                      const bucketIndex = pathParts.findIndex(p => p === 'request-documents');
                                      
                                      if (bucketIndex === -1 || !newWindow) {
                                        if (newWindow) newWindow.close();
                                        window.open(url, '_blank');
                                        return;
                                      }
                                      
                                      const filePath = pathParts.slice(bucketIndex + 1).join('/');
                                      const { data, error } = await supabase.storage
                                        .from('request-documents')
                                        .createSignedUrl(filePath, 3600);
                                      
                                      if (error || !data?.signedUrl) {
                                        console.error('Error creating signed URL:', error);
                                        newWindow.location.href = url;
                                        return;
                                      }
                                      
                                      newWindow.location.href = data.signedUrl;
                                    } catch (error) {
                                      console.error('Error opening document:', error);
                                      if (newWindow) newWindow.location.href = url;
                                    }
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Просмотр
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  asChild
                                >
                                  <a href={url} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3 w-3 mr-1" />
                                    Скачать
                                  </a>
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteDocument(url)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {allPhotos.length === 0 && allDocuments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Файлы не прикреплены</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 6. Activity Feed - System history separated */}
            <RequestActivityFeed activities={activities} />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions - Status, Priority, Notes */}
            <RequestQuickActionsCard
              request={request}
              statuses={statuses}
              priorities={priorities}
              canEdit={canEdit}
              onUpdate={handleUpdate}
            />

            {/* Executor */}
            {request.executor && (
              <Card className="glassmorphism border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Исполнитель
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/15 text-primary text-sm">
                        {request.executor.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{request.executor}</p>
                      <p className="text-xs text-muted-foreground">Ответственный</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Archive */}
            {canEdit && (
              <Card className="glassmorphism border-border/40">
                <CardContent className="pt-4">
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50">
                        <Trash2 className="h-4 w-4" />
                        В архив
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Переместить в архив?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Заявка #{request.request_number} будет перемещена в архив.
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
