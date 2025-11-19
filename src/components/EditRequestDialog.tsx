import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, X, Image, FileText, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Request } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { notifyTelegram } from "@/lib/telegram";

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
  payment_percentage: z.number()
    .min(0, "Процент не может быть отрицательным")
    .max(100, "Процент не может превышать 100")
    .default(0),
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
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
      availability_delivery_time: "",
      contractor: "",
      invoice_number: "",
      amount: 0,
      payment_percentage: 0,
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
        availability_delivery_time: request.availability_delivery_time || "",
        contractor: request.contractor || "",
        invoice_number: request.invoice_number || "",
        amount: request.amount || 0,
        payment_percentage: request.payment_percentage,
        shipment_date: request.shipment_date || "",
        delivery_date: request.delivery_date || "",
        transport_company: request.transport_company || "",
        waybill_number: request.waybill_number || "",
        comments: request.comments || "",
      });
    }
  }, [request, open, form]);

  const onSubmit = async (data: RequestFormData) => {
    if (!request) return;
    
    setIsSubmitting(true);
    try {
      let photoUrl = request.photo_url;
      let documentUrl = request.document_url;

      // Helper function to sanitize filenames
      const sanitizeFilename = (filename: string): string => {
        const extension = filename.split('.').pop() || '';
        // Remove all non-ASCII characters and special chars, keep only alphanumeric, dots, hyphens
        const sanitized = filename
          .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII (cyrillic, etc)
          .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single
          .replace(/^_+|_+$/g, ''); // Trim underscores from start/end
        
        // If sanitization removed everything, use timestamp
        if (!sanitized || sanitized === `.${extension}`) {
          return `file_${Date.now()}.${extension}`;
        }
        
        return sanitized;
      };

      // Upload photo if selected
      if (photoFile) {
        const sanitizedPhotoName = sanitizeFilename(photoFile.name);
        const photoPath = `${request.request_number}/${Date.now()}-${sanitizedPhotoName}`;
        const { error: photoError } = await supabase.storage
          .from("request-photos")
          .upload(photoPath, photoFile);

        if (photoError) throw photoError;

        const { data: photoData } = supabase.storage
          .from("request-photos")
          .getPublicUrl(photoPath);
        
        photoUrl = photoData.publicUrl;
      }

      // Upload document if selected
      if (documentFile) {
        const sanitizedDocName = sanitizeFilename(documentFile.name);
        const documentPath = `${request.request_number}/${Date.now()}-${sanitizedDocName}`;
        const { error: documentError } = await supabase.storage
          .from("request-documents")
          .upload(documentPath, documentFile);

        if (documentError) throw documentError;

        const { data: documentData } = supabase.storage
          .from("request-documents")
          .getPublicUrl(documentPath);
        
        documentUrl = documentData.publicUrl;
      }

      const requestData = {
        request_date: data.request_date,
        description: data.description,
        status: data.status,
        priority: data.priority,
        applicant: data.applicant,
        executor: data.executor || null,
        availability_delivery_time: data.availability_delivery_time || null,
        contractor: data.contractor || null,
        invoice_number: data.invoice_number || null,
        amount: data.amount || 0,
        payment_percentage: data.payment_percentage,
        shipment_date: data.shipment_date || null,
        delivery_date: data.delivery_date || null,
        transport_company: data.transport_company || null,
        waybill_number: data.waybill_number || null,
        comments: data.comments || null,
        photo_url: photoUrl,
        document_url: documentUrl,
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

      setPhotoFile(null);
      setDocumentFile(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{isViewer ? "Просмотр заявки" : "Редактировать заявку"}</DialogTitle>
              <DialogDescription>
                {isViewer 
                  ? `Просмотр заявки ${request?.request_number}` 
                  : `Внесите изменения в заявку ${request?.request_number}`
                }
              </DialogDescription>
            </div>
            {request?.document_url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    // Extract bucket and path from document_url
                    const url = new URL(request.document_url!);
                    const pathParts = url.pathname.split('/');
                    const bucketIndex = pathParts.findIndex(p => p === 'request-documents');
                    if (bucketIndex === -1) {
                      window.open(request.document_url!, '_blank');
                      return;
                    }
                    const filePath = pathParts.slice(bucketIndex + 1).join('/');
                    
                    // Generate signed URL
                    const { data, error } = await supabase.storage
                      .from('request-documents')
                      .createSignedUrl(filePath, 3600); // 1 hour expiry
                    
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
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание заявки *</FormLabel>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contractor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контрагент</FormLabel>
                    <FormControl>
                      <Input placeholder="ООО Компания" disabled={isViewer} {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="В наличии / 2 недели" disabled={isViewer} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <FormLabel>Сумма</FormLabel>
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
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        disabled={isViewer}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Фото заявки</Label>
                {request?.photo_url && (
                  <div className="mb-2">
                    <a 
                      href={request.photo_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Image className="h-4 w-4" />
                      Открыть фото
                    </a>
                  </div>
                )}
                {!isViewer && (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Image className="h-4 w-4" />
                        Выбрать фото
                      </Button>
                      {photoFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate max-w-[150px]">{photoFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setPhotoFile(null);
                              if (photoInputRef.current) photoInputRef.current.value = "";
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP до 5 МБ
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Документ (Счёт/КП)</Label>
                {request?.document_url && (
                  <div className="mb-2">
                    <Button 
                      type="button"
                      variant="link"
                      size="sm"
                      className="inline-flex items-center gap-2 px-0 h-auto"
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
                    >
                      <FileText className="h-4 w-4" />
                      Открыть документ
                    </Button>
                  </div>
                )}
                {!isViewer && (
                  <>
                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => documentInputRef.current?.click()}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Выбрать файл
                      </Button>
                      {documentFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate max-w-[150px]">{documentFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setDocumentFile(null);
                              if (documentInputRef.current) documentInputRef.current.value = "";
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX, XLS, XLSX до 10 МБ
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
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
              <div className="flex gap-2 ml-auto">
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
      </DialogContent>

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
    </Dialog>
  );
};
