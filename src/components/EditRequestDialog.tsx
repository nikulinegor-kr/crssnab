import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Image, FileText, Trash2, Copy, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Request } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { notifyTelegram } from "@/lib/telegram";
import { createNotification } from "@/hooks/useNotifications";

const requestSchema = z.object({
  request_date: z.string()
    .min(1, "Дата заявки обязательна")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Неверный формат даты"),
  description: z.string()
    .trim()
    .min(3, "Описание должно содержать минимум 3 символа")
    .max(500, "Описание не должно превышать 500 символов"),
  status: z.string()
    .min(1, "Выберите статус"),
  priority: z.string()
    .min(1, "Выберите приоритет"),
  applicant: z.string()
    .trim()
    .min(1, "Укажите заявителя")
    .max(200, "Максимум 200 символов"),
  executor: z.string()
    .trim()
    .max(200, "Максимум 200 символов")
    .optional(),
  object_id: z.string().optional(),
  estimated_delivery_days: z.number()
    .min(0, "Не может быть отрицательным")
    .optional()
    .nullable(),
  availability_delivery_time: z.string()
    .max(200, "Максимум 200 символов")
    .optional(),
  contractor: z.string()
    .trim()
    .max(200, "Название контрагента не должно превышать 200 символов")
    .optional(),
  invoice_number: z.string()
    .trim()
    .max(100, "Номер счета не должен превышать 100 символов")
    .optional(),
  amount: z.number()
    .min(0, "Сумма не может быть отрицательной")
    .default(0),
  payment_percentage: z.string()
    .max(100, "Максимум 100 символов")
    .optional()
    .default(""),
  shipment_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Неверный формат даты")
    .optional()
    .or(z.literal("")),
  delivery_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Неверный формат даты")
    .optional()
    .or(z.literal("")),
  transport_company: z.string()
    .trim()
    .max(200, "Название ТК не должно превышать 200 символов")
    .optional(),
  waybill_number: z.string()
    .trim()
    .max(100, "Номер ТТН не должен превышать 100 символов")
    .optional(),
  comments: z.string()
    .trim()
    .max(1000, "Комментарий не должен превышать 1000 символов")
    .optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface EditRequestDialogProps {
  request: Request | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditRequestDialog = ({ request, open, onOpenChange }: EditRequestDialogProps) => {
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [existingDocumentUrls, setExistingDocumentUrls] = useState<string[]>([]);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewer } = useUserRole();

  // Fetch participants
  const { data: participants } = useQuery({
    queryKey: ["request-participants", request?.organization_id],
    queryFn: async () => {
      if (!request?.organization_id) return [];
      const { data, error } = await supabase
        .from("request_participants")
        .select("*")
        .eq("organization_id", request.organization_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!request?.organization_id && open,
  });

  const applicants = participants?.filter((p) => p.participant_type === "applicant") || [];
  const executors = participants?.filter((p) => p.participant_type === "executor") || [];

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", request?.organization_id],
    queryFn: async () => {
      if (!request?.organization_id) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", request.organization_id)
        .eq("status", "Активный")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!request?.organization_id && open,
  });

  // Fetch statuses
  const { data: statusesData } = useQuery({
    queryKey: ["request-statuses", request?.organization_id],
    queryFn: async () => {
      if (!request?.organization_id) return [];
      const { data, error } = await supabase
        .from("request_statuses")
        .select("*")
        .eq("organization_id", request.organization_id)
        .order("order");

      if (error) throw error;
      return data;
    },
    enabled: !!request?.organization_id && open,
  });

  // Fetch priorities
  const { data: prioritiesData } = useQuery({
    queryKey: ["request-priorities", request?.organization_id],
    queryFn: async () => {
      if (!request?.organization_id) return [];
      const { data, error } = await supabase
        .from("request_priorities")
        .select("*")
        .eq("organization_id", request.organization_id)
        .order("order");

      if (error) throw error;
      return data;
    },
    enabled: !!request?.organization_id && open,
  });

  // Fetch objects
  const { data: objectsData } = useQuery({
    queryKey: ["request-objects", request?.organization_id],
    queryFn: async () => {
      if (!request?.organization_id) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("*")
        .eq("organization_id", request.organization_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!request?.organization_id && open,
  });

  const statuses = statusesData?.map((s) => s.name) || [];
  const priorities = prioritiesData?.map((p) => p.name) || [];

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      request_date: "",
      description: "",
      status: "Новая заявка",
      priority: "Планово",
      applicant: "",
      executor: "",
      object_id: "",
      estimated_delivery_days: null,
      availability_delivery_time: "",
      contractor: "",
      invoice_number: "",
      amount: 0,
      payment_percentage: "",
      shipment_date: "",
      delivery_date: "",
      transport_company: "",
      waybill_number: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (request && open) {
      form.reset({
        request_date: request.request_date,
        description: request.description,
        status: request.status,
        priority: request.priority,
        applicant: request.applicant || "",
        executor: request.executor || "",
        object_id: request.object_id || "",
        estimated_delivery_days: request.estimated_delivery_days,
        availability_delivery_time: request.availability_delivery_time || "",
        contractor: request.contractor || "",
        invoice_number: request.invoice_number || "",
        amount: request.amount || 0,
        payment_percentage: request.payment_percentage?.toString() || "",
        shipment_date: request.shipment_date || "",
        delivery_date: request.delivery_date || "",
        transport_company: request.transport_company || "",
        waybill_number: request.waybill_number || "",
        comments: request.comments || "",
      });
      // Load existing files
      const photoUrlsArr = request.photo_urls || (request.photo_url ? [request.photo_url] : []);
      const docUrlsArr = request.document_urls || (request.document_url ? [request.document_url] : []);
      setExistingPhotoUrls(photoUrlsArr);
      setExistingDocumentUrls(docUrlsArr);
      setPhotoFiles([]);
      setDocumentFiles([]);
    }
  }, [request, open, form]);

  const handleImproveDescription = async () => {
    const currentDescription = form.getValues("description");
    if (!currentDescription || currentDescription.trim().length < 3) {
      toast({
        title: "Введите описание",
        description: "Сначала введите описание заявки для улучшения",
        variant: "destructive",
      });
      return;
    }

    setIsImprovingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-description", {
        body: { description: currentDescription },
      });

      if (error) throw error;

      if (data?.improved) {
        form.setValue("description", data.improved);
        toast({
          title: "Описание улучшено",
          description: "AI переформулировал описание заявки",
        });
      }
    } catch (error: any) {
      console.error("Error improving description:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось улучшить описание",
        variant: "destructive",
      });
    } finally {
      setIsImprovingDescription(false);
    }
  };


  const onSubmit = async (data: RequestFormData) => {
    if (!request) return;
    
    setIsSubmitting(true);
    try {
      // Helper function to sanitize filenames
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

      // Upload new photos
      const newPhotoUrls: string[] = [];
      for (const photoFile of photoFiles) {
        const sanitizedPhotoName = sanitizeFilename(photoFile.name);
        const photoPath = `${request.request_number}/${Date.now()}-${sanitizedPhotoName}`;
        const { error: photoError } = await supabase.storage
          .from("request-photos")
          .upload(photoPath, photoFile);
        if (photoError) throw photoError;
        const { data: photoData } = supabase.storage.from("request-photos").getPublicUrl(photoPath);
        newPhotoUrls.push(photoData.publicUrl);
      }

      // Upload new documents
      const newDocumentUrls: string[] = [];
      for (const documentFile of documentFiles) {
        const sanitizedDocName = sanitizeFilename(documentFile.name);
        const documentPath = `${request.request_number}/${Date.now()}-${sanitizedDocName}`;
        const { error: documentError } = await supabase.storage
          .from("request-documents")
          .upload(documentPath, documentFile);
        if (documentError) throw documentError;
        const { data: documentData } = supabase.storage.from("request-documents").getPublicUrl(documentPath);
        newDocumentUrls.push(documentData.publicUrl);
      }

      // Combine existing and new URLs
      const finalPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls];
      const finalDocumentUrls = [...existingDocumentUrls, ...newDocumentUrls];

      const requestData = {
        request_date: data.request_date,
        description: data.description,
        status: data.status,
        priority: data.priority,
        applicant: data.applicant,
        executor: data.executor || null,
        object_id: data.object_id || null,
        estimated_delivery_days: data.estimated_delivery_days || null,
        availability_delivery_time: data.availability_delivery_time || null,
        contractor: data.contractor || null,
        invoice_number: data.invoice_number || null,
        amount: data.amount || 0,
        payment_percentage: data.payment_percentage ? parseInt(data.payment_percentage.replace('%', '')) || 0 : 0,
        shipment_date: data.shipment_date || null,
        delivery_date: data.delivery_date || null,
        transport_company: data.transport_company || null,
        waybill_number: data.waybill_number || null,
        comments: data.comments || null,
        photo_url: finalPhotoUrls[0] || null,
        document_url: finalDocumentUrls[0] || null,
        photo_urls: finalPhotoUrls,
        document_urls: finalDocumentUrls,
      };

      const { error } = await supabase
        .from("requests")
        .update(requestData)
        .eq("id", request.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Заявка обновлена",
      });

      // Send Telegram notification if auto-send is enabled and status changed
      const statusChanged = data.status !== request.status;
      
      const { data: orgData } = await supabase
        .from("organizations")
        .select("telegram_auto_send_on_status_change")
        .eq("id", request.organization_id)
        .single();
      
      if (orgData?.telegram_auto_send_on_status_change && statusChanged) {
        await notifyTelegram(request.id);
      }

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });

      setPhotoFiles([]);
      setDocumentFiles([]);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить заявку",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!request) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("requests")
        .delete()
        .eq("id", request.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Заявка удалена",
      });

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить заявку",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const headerContent = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 className="text-lg font-semibold">{isViewer ? "Просмотр заявки" : "Редактировать заявку"}</h2>
        <p className="text-sm text-muted-foreground">
          {isViewer 
            ? `Просмотр заявки ${request?.request_number}` 
            : `Внесите изменения в заявку ${request?.request_number}`
          }
        </p>
      </div>
      {request?.document_url && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const url = new URL(request.document_url!);
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.findIndex(p => p === 'request-documents');
              if (bucketIndex === -1) {
                window.open(request.document_url!, '_blank');
                return;
              }
              const filePath = pathParts.slice(bucketIndex + 1).join('/');
              const { data, error } = await supabase.storage
                .from('request-documents')
                .createSignedUrl(filePath, 3600);
              if (error || !data) {
                console.error('Error creating signed URL:', error);
                window.open(request.document_url!, '_blank');
                return;
              }
              window.open(data.signedUrl, '_blank');
            } catch (error) {
              console.error('Error opening document:', error);
              window.open(request.document_url!, '_blank');
            }
          }}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Открыть счёт
        </Button>
      )}
    </div>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Блок 1: Основная информация */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Основная информация</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="request_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата заявки *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isViewer} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Статус *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isViewer}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите статус" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Приоритет *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isViewer}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите приоритет" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="object_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Объект</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewer}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите объект" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {objectsData?.map((obj) => (
                            <SelectItem key={obj.id} value={obj.id}>
                              {obj.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Блок 2: Описание */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Описание заявки *</FormLabel>
                      {!isViewer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleImproveDescription}
                          disabled={isImprovingDescription}
                          className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                        >
                          {isImprovingDescription ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          Улучшить с AI
                        </Button>
                      )}
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Опишите заявку..."
                        className="min-h-[80px]"
                        disabled={isViewer}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Блок 3: Участники */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Участники</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="applicant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Заявитель *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewer}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите заявителя" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {applicants.map((applicant) => (
                            <SelectItem key={applicant.id} value={applicant.name}>
                              {applicant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="executor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Исполнитель</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewer}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите исполнителя" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {executors.map((executor) => (
                            <SelectItem key={executor.id} value={executor.name}>
                              {executor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Блок 4: Поставщик */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Поставщик</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contractor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Контрагент</FormLabel>
                      <div className="flex gap-2">
                        <Select 
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value)} 
                          disabled={isViewer}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Выбрать из списка" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers?.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.name}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Dialog open={isAddingSupplier} onOpenChange={setIsAddingSupplier}>
                          <DialogTrigger asChild>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              className="shrink-0"
                              disabled={isViewer}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Добавить контрагента</DialogTitle>
                              <DialogDescription>
                                Создайте нового контрагента для быстрого выбора
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="supplier-name-edit">Название</Label>
                                <Input
                                  id="supplier-name-edit"
                                  value={newSupplierName}
                                  onChange={(e) => setNewSupplierName(e.target.value)}
                                  placeholder="Название контрагента"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setIsAddingSupplier(false);
                                  setNewSupplierName("");
                                }}
                              >
                                Отмена
                              </Button>
                              <Button
                                type="button"
                                onClick={async () => {
                                  if (!newSupplierName.trim()) {
                                    toast({
                                      title: "Ошибка",
                                      description: "Введите название контрагента",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  try {
                                    const { data: userData } = await supabase.auth.getUser();
                                    
                                    const { error } = await supabase
                                      .from("suppliers")
                                      .insert({
                                        name: newSupplierName.trim(),
                                        organization_id: request?.organization_id || "",
                                        created_by: userData.user?.id,
                                        status: "Активный",
                                        category: "Другое",
                                      });

                                    if (error) throw error;

                                    toast({
                                      title: "Успешно",
                                      description: "Контрагент добавлен",
                                    });

                                    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
                                    field.onChange(newSupplierName.trim());
                                    setIsAddingSupplier(false);
                                    setNewSupplierName("");
                                  } catch (error) {
                                    console.error("Error adding supplier:", error);
                                    toast({
                                      title: "Ошибка",
                                      description: "Не удалось добавить контрагента",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Добавить
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="availability_delivery_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Наличие / Сроки поставки</FormLabel>
                      <Select 
                        value={field.value || ""}
                        onValueChange={(value) => field.onChange(value)} 
                        disabled={isViewer}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выбрать" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="В наличии">В наличии</SelectItem>
                          <SelectItem value="1-2 дня">1-2 дня</SelectItem>
                          <SelectItem value="3-5 дней">3-5 дней</SelectItem>
                          <SelectItem value="1-2 недели">1-2 недели</SelectItem>
                          <SelectItem value="2-4 недели">2-4 недели</SelectItem>
                          <SelectItem value="Под заказ">Под заказ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Блок 5: Финансы */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Финансы</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер счета</FormLabel>
                      <FormControl>
                        <Input placeholder="№ 123" disabled={isViewer} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сумма (₽)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          disabled={isViewer}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Оплата (%)</FormLabel>
                      <FormControl>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Select
                            value={field.value?.toString() || ""}
                            onValueChange={(value) => field.onChange(value)}
                            disabled={isViewer}
                          >
                            <SelectTrigger className="w-full sm:w-24 shrink-0">
                              <SelectValue placeholder="%" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0%">0%</SelectItem>
                              <SelectItem value="10%">10%</SelectItem>
                              <SelectItem value="20%">20%</SelectItem>
                              <SelectItem value="30%">30%</SelectItem>
                              <SelectItem value="40%">40%</SelectItem>
                              <SelectItem value="50%">50%</SelectItem>
                              <SelectItem value="60%">60%</SelectItem>
                              <SelectItem value="70%">70%</SelectItem>
                              <SelectItem value="80%">80%</SelectItem>
                              <SelectItem value="90%">90%</SelectItem>
                              <SelectItem value="100%">100%</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Или вручную"
                            disabled={isViewer}
                            value={field.value?.toString() || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Блок 6: Доставка */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Доставка</h3>
              
              <FormField
                control={form.control}
                name="estimated_delivery_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ориентировочный срок (дней)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Кол-во дней"
                        disabled={isViewer}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        className="max-w-[150px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shipment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата отгрузки</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={isViewer} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата доставки</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={isViewer} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transport_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Транспортная компания</FormLabel>
                      <FormControl>
                        <Input placeholder="ТК Компания" disabled={isViewer} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="waybill_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер ТТН</FormLabel>
                      <FormControl>
                        <Input placeholder="№ ТТН" disabled={isViewer} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Блок 7: Дополнительно */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Дополнительно</h3>
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Комментарий</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Дополнительная информация..."
                        className="min-h-[60px]"
                        disabled={isViewer}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ЗРС - автоматически заполняемое поле */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label>ЗРС (сводка заявки)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const zrsText = `Объект: ${objectsData?.find(o => o.id === form.watch("object_id"))?.name || "-"}
Заявка: ${form.watch("description") || "-"}
Заявитель: ${form.watch("applicant") || "-"}
Приоритет: ${form.watch("priority") || "-"}
Наличие: ${form.watch("availability_delivery_time") || "-"}
Срок доставки: ${form.watch("estimated_delivery_days") ? `${form.watch("estimated_delivery_days")} дн.` : "-"}
Оплата: ${form.watch("payment_percentage") || "-"}
Исполнил: ${form.watch("executor") || "-"}`;
                      try {
                        await navigator.clipboard.writeText(zrsText);
                        toast({ title: "Скопировано", description: "Текст ЗРС скопирован в буфер обмена" });
                      } catch {
                        toast({ title: "Ошибка", description: "Не удалось скопировать текст", variant: "destructive" });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Копировать
                  </Button>
                </div>
                <Textarea
                  readOnly
                  className="min-h-[120px] bg-muted/50 font-mono text-sm"
                  value={`Объект: ${objectsData?.find(o => o.id === form.watch("object_id"))?.name || "-"}
Заявка: ${form.watch("description") || "-"}
Заявитель: ${form.watch("applicant") || "-"}
Приоритет: ${form.watch("priority") || "-"}
Наличие: ${form.watch("availability_delivery_time") || "-"}
Срок доставки: ${form.watch("estimated_delivery_days") ? `${form.watch("estimated_delivery_days")} дн.` : "-"}
Оплата: ${form.watch("payment_percentage") || "-"}
Исполнил: ${form.watch("executor") || "-"}`}
                />
              </div>
            </div>

            {/* Блок 8: Вложения */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-medium text-sm text-muted-foreground">Вложения</h3>
              {!isViewer ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MultiFileDropZone
                    accept="image/*"
                    files={photoFiles}
                    onFilesChange={setPhotoFiles}
                    existingUrls={existingPhotoUrls}
                    onRemoveExisting={(url) => setExistingPhotoUrls(prev => prev.filter(u => u !== url))}
                    label="Фото заявки"
                    hint="JPG, PNG, WEBP до 5 МБ, максимум 10 файлов"
                    icon="image"
                    maxSizeMB={5}
                    maxFiles={10}
                  />

                  <MultiFileDropZone
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    files={documentFiles}
                    onFilesChange={setDocumentFiles}
                    existingUrls={existingDocumentUrls}
                    onRemoveExisting={(url) => setExistingDocumentUrls(prev => prev.filter(u => u !== url))}
                    label="Документы (Счёт/КП)"
                    hint="PDF, DOC, DOCX, XLS, XLSX до 10 МБ, максимум 10 файлов"
                    icon="document"
                    maxSizeMB={10}
                    maxFiles={10}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Фото ({existingPhotoUrls.length})</Label>
                    {existingPhotoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                        Фото {i + 1}
                      </a>
                    ))}
                    {existingPhotoUrls.length === 0 && <p className="text-sm text-muted-foreground">Нет фото</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Документы ({existingDocumentUrls.length})</Label>
                    {existingDocumentUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                        Документ {i + 1}
                      </a>
                    ))}
                    {existingDocumentUrls.length === 0 && <p className="text-sm text-muted-foreground">Нет документов</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
              {canEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isSubmitting || isDeleting}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || isDeleting}
                >
                  {isViewer ? "Закрыть" : "Отмена"}
                </Button>
                {canEdit && (
                  <Button type="submit" disabled={isSubmitting || isDeleting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить изменения
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
  );

  const alertDialogContent = (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
          <AlertDialogDescription>
            Это действие нельзя отменить. Заявка {request?.request_number} будет удалена навсегда.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="h-[100dvh] max-h-[100dvh]">
            <DrawerHeader className="text-left border-b pb-4 flex-shrink-0">
              {headerContent}
            </DrawerHeader>
            <div 
              className="flex-1 overflow-y-auto p-4 pb-8"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
        {alertDialogContent}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {headerContent}
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
      {alertDialogContent}
    </>
  );
};
