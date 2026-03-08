import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
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
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  FileText, 
  Trash2, 
  Save,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
  Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Request } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { notifyTelegram } from "@/lib/telegram";
import { useEditRequestDraft } from "@/hooks/useEditRequestDraft";
import { useContractorSuggestions } from "@/hooks/useContractorSuggestions";

// Section components (shared with CreateRequestDialog)
import { ContextSection } from "./create-request/ContextSection";
import { CoreParamsSection } from "./create-request/CoreParamsSection";
import { StatusResponsiblesSection } from "./create-request/StatusResponsiblesSection";
import { LogisticsSection } from "./create-request/LogisticsSection";
import { FinanceSection } from "./create-request/FinanceSection";
import { AdditionalSection } from "./create-request/AdditionalSection";
import { ErpSection } from "./create-request/ErpSection";

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
    .nullable()
    .optional(),
  payment_status: z.string().optional(),
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
  product_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  quantity: z.number().min(1, "Минимум 1").nullable().optional(),
  unit: z.string().optional(),
  operation_type: z.string().optional(),
  planned_delivery_date: z.string().optional().or(z.literal("")),
  reserve_on_warehouse: z.boolean().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface EditRequestDialogProps {
  request: Request | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const EditRequestDialog = ({ request, open, onOpenChange }: EditRequestDialogProps) => {
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [existingDocumentUrls, setExistingDocumentUrls] = useState<string[]>([]);
  const [serverSaveState, setServerSaveState] = useState<SaveState>('idle');
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewer } = useUserRole();
  const { recentContractors, recentTransportCompanies } = useContractorSuggestions();
  const formId = "edit-request-form";
  
  const serverSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastServerSaveRef = useRef<string>("");

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
      amount: null,
      payment_status: "Не выставлен",
      shipment_date: "",
      delivery_date: "",
      transport_company: "",
      waybill_number: "",
      comments: "",
      product_id: "",
      warehouse_id: "",
      quantity: 1,
      unit: "шт",
      operation_type: "",
      planned_delivery_date: "",
      reserve_on_warehouse: false,
    },
  });

  // Original values for draft comparison
  const originalValues = useMemo(() => {
    if (!request) return null;
    return {
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
      amount: request.amount ?? null,
      payment_percentage: request.payment_percentage ?? 0,
      shipment_date: request.shipment_date || "",
      delivery_date: request.delivery_date || "",
      transport_company: request.transport_company || "",
      waybill_number: request.waybill_number || "",
      comments: request.comments || "",
      product_id: (request as any).product_id || "",
      warehouse_id: (request as any).warehouse_id || "",
      quantity: (request as any).quantity ?? 1,
      unit: (request as any).unit || "шт",
      operation_type: (request as any).operation_type || "",
      planned_delivery_date: (request as any).planned_delivery_date || "",
      reserve_on_warehouse: (request as any).reserve_on_warehouse || false,
    };
  }, [request]);

  const formValues = form.watch();
  
  // Draft hook with enhanced features
  const { 
    clearDraft, 
    restoreDraft, 
    dismissDraft,
    draftSaveState, 
    draftInfo,
    hasUnsavedChanges,
  } = useEditRequestDraft(
    request?.id,
    formValues,
    (values) => {
      Object.entries(values).forEach(([key, value]) => {
        form.setValue(key as keyof RequestFormData, value as any);
      });
    },
    open,
    originalValues
  );

  // Initialize form with request data
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
        amount: request.amount ?? null,
        payment_status: (request as any).payment_status || "Не выставлен",
        invoice_date: (request as any).invoice_date || "",
        shipment_date: request.shipment_date || "",
        delivery_date: request.delivery_date || "",
        transport_company: request.transport_company || "",
        waybill_number: request.waybill_number || "",
        comments: request.comments || "",
        product_id: (request as any).product_id || "",
        warehouse_id: (request as any).warehouse_id || "",
        quantity: (request as any).quantity ?? 1,
        unit: (request as any).unit || "шт",
        operation_type: (request as any).operation_type || "",
        planned_delivery_date: (request as any).planned_delivery_date || "",
        reserve_on_warehouse: (request as any).reserve_on_warehouse || false,
      });
      
      const photoUrlsArr = request.photo_urls || (request.photo_url ? [request.photo_url] : []);
      const docUrlsArr = request.document_urls || (request.document_url ? [request.document_url] : []);
      setExistingPhotoUrls(photoUrlsArr);
      setExistingDocumentUrls(docUrlsArr);
      setPhotoFiles([]);
      setDocumentFiles([]);
      setServerUpdatedAt(request.updated_at || null);
      setServerSaveState('idle');
    }
  }, [request, open, form]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
      if (conflictCheckIntervalRef.current) clearInterval(conflictCheckIntervalRef.current);
    };
  }, []);

  // Check for conflicts periodically
  useEffect(() => {
    if (!open || !request?.id) return;
    
    const checkConflict = async () => {
      try {
        const { data } = await supabase
          .from("requests")
          .select("updated_at")
          .eq("id", request.id)
          .single();
        
        if (data?.updated_at && serverUpdatedAt && data.updated_at !== serverUpdatedAt) {
          const timeSinceLastSave = Date.now() - (lastServerSaveRef.current ? parseInt(lastServerSaveRef.current) : 0);
          if (timeSinceLastSave > 5000) {
            setShowConflictDialog(true);
          }
        }
      } catch {
        // Ignore errors
      }
    };
    
    conflictCheckIntervalRef.current = setInterval(checkConflict, 15000);
    return () => {
      if (conflictCheckIntervalRef.current) clearInterval(conflictCheckIntervalRef.current);
    };
  }, [open, request?.id, serverUpdatedAt]);

  // Auto-save to server with debounce
  const saveToServer = useCallback(async (data: RequestFormData) => {
    if (!request || !canEdit) return;
    
    const result = requestSchema.safeParse(data);
    if (!result.success) return;
    
    setServerSaveState('saving');
    
    try {
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
        amount: data.amount ?? null,
        payment_status: data.payment_status || "Не выставлен",
        invoice_date: data.invoice_date || null,
        shipment_date: data.shipment_date || null,
        delivery_date: data.delivery_date || null,
        transport_company: data.transport_company || null,
        waybill_number: data.waybill_number || null,
        comments: data.comments || null,
        product_id: data.product_id || null,
        warehouse_id: data.warehouse_id || null,
        quantity: data.quantity || 1,
        unit: data.unit || "шт",
        operation_type: data.operation_type || null,
        planned_delivery_date: data.planned_delivery_date || null,
        reserve_on_warehouse: data.reserve_on_warehouse || false,
      };

      const { data: updatedData, error } = await supabase
        .from("requests")
        .update(requestData)
        .eq("id", request.id)
        .select("updated_at")
        .single();

      if (error) throw error;

      setServerUpdatedAt(updatedData.updated_at);
      lastServerSaveRef.current = Date.now().toString();
      setServerSaveState('saved');
      
      // Auto-send telegram if status changed
      const statusChanged = data.status !== request.status;
      if (statusChanged) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("telegram_auto_send_on_status_change")
          .eq("id", request.organization_id)
          .single();
        
        if (orgData?.telegram_auto_send_on_status_change) {
          await notifyTelegram(request.id);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      
    } catch (error) {
      console.error("Auto-save error:", error);
      setServerSaveState('error');
    }
  }, [request, canEdit, queryClient]);

  // Debounced server save on form change
  useEffect(() => {
    if (!open || !canEdit || isViewer) return;
    
    const subscription = form.watch((value) => {
      if (serverSaveTimeoutRef.current) {
        clearTimeout(serverSaveTimeoutRef.current);
      }
      
      serverSaveTimeoutRef.current = setTimeout(() => {
        saveToServer(value as RequestFormData);
      }, 2000);
    });

    return () => subscription.unsubscribe();
  }, [open, canEdit, isViewer, form, saveToServer]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        form.handleSubmit(onSubmit)();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, form]);

  // Handle close with confirmation
  const handleClose = useCallback(() => {
    if (serverSaveState === 'saved' || !hasUnsavedChanges()) {
      clearDraft();
      onOpenChange(false);
    } else {
      setShowCloseConfirmDialog(true);
    }
  }, [serverSaveState, hasUnsavedChanges, clearDraft, onOpenChange]);

  // Force close without saving
  const forceClose = useCallback(() => {
    clearDraft();
    setShowCloseConfirmDialog(false);
    onOpenChange(false);
  }, [clearDraft, onOpenChange]);

  // Refresh data from server (conflict resolution)
  const refreshFromServer = useCallback(async () => {
    if (!request?.id) return;
    
    const { data } = await supabase
      .from("requests")
      .select("*")
      .eq("id", request.id)
      .single();
    
    if (data) {
      form.reset({
        request_date: data.request_date,
        description: data.description,
        status: data.status,
        priority: data.priority,
        applicant: data.applicant || "",
        executor: data.executor || "",
        object_id: data.object_id || "",
        estimated_delivery_days: data.estimated_delivery_days,
        availability_delivery_time: data.availability_delivery_time || "",
        contractor: data.contractor || "",
        invoice_number: data.invoice_number || "",
        amount: data.amount ?? null,
        payment_status: (data as any).payment_status || "Не выставлен",
        invoice_date: (data as any).invoice_date || "",
        shipment_date: data.shipment_date || "",
        delivery_date: data.delivery_date || "",
        transport_company: data.transport_company || "",
        waybill_number: data.waybill_number || "",
        comments: data.comments || "",
        product_id: data.product_id || "",
        warehouse_id: data.warehouse_id || "",
        quantity: data.quantity ?? 1,
        unit: data.unit || "шт",
        operation_type: data.operation_type || "",
        planned_delivery_date: data.planned_delivery_date || "",
        reserve_on_warehouse: data.reserve_on_warehouse || false,
      });
      setServerUpdatedAt(data.updated_at);
      clearDraft();
    }
    setShowConflictDialog(false);
  }, [request?.id, form, clearDraft]);

  const onSubmit = async (data: RequestFormData) => {
    if (!request) return;
    
    setIsSubmitting(true);
    setServerSaveState('saving');
    
    try {
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
        amount: data.amount ?? null,
        payment_status: data.payment_status || "Не выставлен",
        invoice_date: data.invoice_date || null,
        shipment_date: data.shipment_date || null,
        delivery_date: data.delivery_date || null,
        transport_company: data.transport_company || null,
        waybill_number: data.waybill_number || null,
        comments: data.comments || null,
        product_id: data.product_id || null,
        warehouse_id: data.warehouse_id || null,
        quantity: data.quantity || 1,
        unit: data.unit || "шт",
        operation_type: data.operation_type || null,
        planned_delivery_date: data.planned_delivery_date || null,
        reserve_on_warehouse: data.reserve_on_warehouse || false,
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
        description: "Заявка сохранена",
      });

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
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });

      clearDraft();
      setServerSaveState('saved');
      setPhotoFiles([]);
      setDocumentFiles([]);
      onOpenChange(false);
    } catch (error: any) {
      setServerSaveState('error');
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить заявку",
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
      clearDraft();
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

  // Save indicator component
  const SaveIndicator = () => {
    const getDraftIndicator = () => {
      if (draftSaveState === 'saving') {
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Черновик...
          </span>
        );
      }
      if (draftSaveState === 'saved') {
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Save className="h-3 w-3" />
            Черновик
          </span>
        );
      }
      return null;
    };

    const getServerIndicator = () => {
      switch (serverSaveState) {
        case 'saving':
          return (
            <Badge variant="outline" className="text-xs gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              <Loader2 className="h-3 w-3 animate-spin" />
              Сохраняется...
            </Badge>
          );
        case 'saved':
          return (
            <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
              <Check className="h-3 w-3" />
              Сохранено
            </Badge>
          );
        case 'error':
          return (
            <Badge variant="outline" className="text-xs gap-1 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
              <AlertTriangle className="h-3 w-3" />
              Ошибка
            </Badge>
          );
        default:
          return getDraftIndicator();
      }
    };

    return getServerIndicator();
  };

  // Draft recovery banner
  const DraftRecoveryBanner = () => {
    if (!draftInfo.exists || isViewer) return null;
    
    return (
      <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">
            Найден черновик от {draftInfo.formattedDate}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={restoreDraft}
            className="h-7 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Восстановить
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={dismissDraft}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  // Auto-scroll to focused input on mobile
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (isMobile) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }, 300);
    }
  };

  const headerContent = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isViewer ? "Просмотр заявки" : "Редактировать заявку"}</h2>
          {!isViewer && <SaveIndicator />}
        </div>
        <p className="text-sm text-muted-foreground">
          {isViewer 
            ? `Просмотр заявки ${request?.request_number}` 
            : `Заявка ${request?.request_number}`
          }
          {!isViewer && (
            <span className="ml-2 text-xs opacity-70">
              Ctrl+Enter — сохранить, Esc — закрыть
            </span>
          )}
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
                window.open(request.document_url!, '_blank');
                return;
              }
              window.open(data.signedUrl, '_blank');
            } catch {
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
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5 sm:space-y-6"
        onFocus={handleInputFocus as any}
      >
        {/* Draft Recovery Banner */}
        <DraftRecoveryBanner />

        {/* 1. Context Block: Description + Comment */}
        <ContextSection 
          form={form} 
          draftSaveState={draftSaveState}
          autoFocus={!isViewer}
          disabled={isViewer}
        />

        {/* 2. Core Params: Date, Object */}
        <CoreParamsSection
          form={form}
          objectsData={objectsData}
          currentOrgId={request?.organization_id || null}
          disabled={isViewer}
        />

        {/* 3. Status & Responsibles */}
        <StatusResponsiblesSection
          form={form}
          statuses={statuses}
          priorities={priorities}
          applicants={applicants}
          executors={executors}
          currentOrgId={request?.organization_id || null}
          disabled={isViewer}
        />

        {/* 4. Finance */}
        <FinanceSection 
          form={form} 
          disabled={isViewer}
        />

        {/* 5. ERP / Склад */}
        <ErpSection
          form={form}
          currentOrgId={request?.organization_id || null}
          disabled={isViewer}
        />

        {/* 6. Logistics: TK, TTN, Dates */}
        <LogisticsSection
          form={form}
          recentTransportCompanies={recentTransportCompanies}
          disabled={isViewer}
        />

        {/* 7. Additional: ZRS, Files */}
        <AdditionalSection
          form={form}
          formValues={formValues}
          objectsData={objectsData}
          photoFiles={photoFiles}
          setPhotoFiles={setPhotoFiles}
          documentFiles={documentFiles}
          setDocumentFiles={setDocumentFiles}
          disabled={isViewer}
          existingPhotoUrls={existingPhotoUrls}
          onRemoveExistingPhoto={(url) => setExistingPhotoUrls(prev => prev.filter(u => u !== url))}
          existingDocumentUrls={existingDocumentUrls}
          onRemoveExistingDocument={(url) => setExistingDocumentUrls(prev => prev.filter(u => u !== url))}
        />

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t">
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
              onClick={handleClose}
              disabled={isSubmitting || isDeleting}
            >
              {isViewer ? "Закрыть" : "Отмена"}
            </Button>
            {canEdit && (
              <Button type="submit" disabled={isSubmitting || isDeleting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Сохранить
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );

  // Delete confirmation dialog
  const deleteDialogContent = (
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

  // Close confirmation dialog
  const closeConfirmDialogContent = (
    <AlertDialog open={showCloseConfirmDialog} onOpenChange={setShowCloseConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
          <AlertDialogDescription>
            Изменения не были сохранены на сервер. Закрыть без сохранения?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
          <AlertDialogAction onClick={forceClose}>
            Закрыть без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Conflict resolution dialog
  const conflictDialogContent = (
    <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Заявка обновилась
          </AlertDialogTitle>
          <AlertDialogDescription>
            Эта заявка была изменена другим пользователем. Выберите действие:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowConflictDialog(false)}>
            Оставить мои изменения
          </AlertDialogCancel>
          <AlertDialogAction onClick={refreshFromServer}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить данные
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => o ? onOpenChange(o) : handleClose()}>
          <DrawerContent className="mt-0 h-[90dvh] max-h-[90dvh] w-full max-w-full overflow-hidden flex flex-col">
            <DrawerHeader className="text-left border-b pb-3 pt-3 flex-shrink-0 flex items-center justify-between">
              {headerContent}
            </DrawerHeader>
            <div 
              className="flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
        {deleteDialogContent}
        {closeConfirmDialogContent}
        {conflictDialogContent}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => o ? onOpenChange(o) : handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {headerContent}
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
      {deleteDialogContent}
      {closeConfirmDialogContent}
      {conflictDialogContent}
    </>
  );
};
