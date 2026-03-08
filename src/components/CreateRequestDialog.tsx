import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useRequestDraft } from "@/hooks/useRequestDraft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { notifyTelegram } from "@/lib/telegram";
import { useContractorSuggestions } from "@/hooks/useContractorSuggestions";

// Section components
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
  invoice_date: z.string().optional().or(z.literal("")),
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

interface InitialRequestData {
  description?: string;
  status?: string;
  priority?: string;
  applicant?: string;
  executor?: string;
  object_id?: string;
  estimated_delivery_days?: number | null;
  availability_delivery_time?: string;
  contractor?: string;
  invoice_number?: string;
  amount?: number;
  payment_percentage?: number;
  transport_company?: string;
  comments?: string;
}

interface CreateRequestDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: InitialRequestData;
}

export const CreateRequestDialog = ({ children, open: externalOpen, onOpenChange, initialData }: CreateRequestDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const isMobile = useIsMobile();
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const formId = "create-request-form";
  
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges()) {
      setShowExitWarning(true);
      setPendingClose(true);
      return;
    }
    
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };
  
  const confirmClose = () => {
    setShowExitWarning(false);
    setPendingClose(false);
    clearDraft();
    form.reset();
    setPhotoFiles([]);
    setDocumentFiles([]);
    
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      setInternalOpen(false);
    }
  };
  
  const cancelClose = () => {
    setShowExitWarning(false);
    setPendingClose(false);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const { recentContractors, recentTransportCompanies } = useContractorSuggestions();

  // Fetch participants
  const { data: participants } = useQuery({
    queryKey: ["request-participants", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_participants")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const applicants = participants?.filter((p) => p.participant_type === "applicant") || [];
  const executors = participants?.filter((p) => p.participant_type === "executor") || [];

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .eq("status", "Активный")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch statuses
  const { data: statusesData } = useQuery({
    queryKey: ["request-statuses", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_statuses")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("order");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch priorities
  const { data: prioritiesData } = useQuery({
    queryKey: ["request-priorities", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_priorities")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("order");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch objects
  const { data: objectsData } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch warehouses for auto-binding
  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses-for-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, object_id")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const statuses = statusesData?.map((s) => s.name) || [];
  const priorities = prioritiesData?.map((p) => p.name) || [];

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      request_date: new Date().toISOString().split("T")[0],
      description: initialData?.description || "",
      status: initialData?.status || "Новая заявка",
      priority: initialData?.priority || "Планово",
      applicant: initialData?.applicant || "",
      executor: initialData?.executor || "",
      object_id: initialData?.object_id || "",
      estimated_delivery_days: initialData?.estimated_delivery_days ?? null,
      availability_delivery_time: initialData?.availability_delivery_time || "",
      contractor: initialData?.contractor || "",
      invoice_number: "",
      amount: null,
      payment_percentage: 0,
      shipment_date: "",
      delivery_date: "",
      transport_company: initialData?.transport_company || "",
      waybill_number: "",
      comments: initialData?.comments || "",
      product_id: "",
      warehouse_id: "",
      quantity: 1,
      unit: "шт",
      operation_type: "",
      planned_delivery_date: "",
      reserve_on_warehouse: false,
    },
  });

  const formValues = form.watch();
  
  // Auto-save draft (localStorage only, NO server calls until submit)
  const { clearDraft, draftSaveState, hasUnsavedChanges } = useRequestDraft(
    formValues as Record<string, unknown>,
    (values) => {
      Object.entries(values).forEach(([key, value]) => {
        form.setValue(key as keyof RequestFormData, value as never);
      });
    },
    open
  );

  // Autofocus on description when dialog opens
  useEffect(() => {
    if (open && descriptionRef.current) {
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Auto-bind warehouse when object changes
  const watchedObjectId = form.watch("object_id");
  useEffect(() => {
    if (watchedObjectId && warehousesData?.length) {
      const objectWarehouse = warehousesData.find((w: any) => w.object_id === watchedObjectId);
      if (objectWarehouse) {
        form.setValue("warehouse_id", objectWarehouse.id);
      }
    } else if (!watchedObjectId) {
      form.setValue("warehouse_id", "");
    }
  }, [watchedObjectId, warehousesData]);

  const onSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true);
    try {
      if (!currentOrgId) {
        toast({
          title: "Ошибка",
          description: "Выберите организацию",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Ошибка",
          description: "Пользователь не авторизован",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const date = new Date(data.request_date);
      const requestNumber = `REQ-${date.getFullYear()}-${Date.now()}`;

      let photoUrls: string[] = [];
      let documentUrls: string[] = [];

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

      // Upload photos
      for (const photoFile of photoFiles) {
        const sanitizedPhotoName = sanitizeFilename(photoFile.name);
        const photoPath = `${requestNumber}/${Date.now()}-${sanitizedPhotoName}`;
        const { error: photoError } = await supabase.storage
          .from("request-photos")
          .upload(photoPath, photoFile);

        if (photoError) throw photoError;

        const { data: photoData } = supabase.storage
          .from("request-photos")
          .getPublicUrl(photoPath);
        
        photoUrls.push(photoData.publicUrl);
      }

      // Upload documents
      for (const documentFile of documentFiles) {
        const sanitizedDocName = sanitizeFilename(documentFile.name);
        const documentPath = `${requestNumber}/${Date.now()}-${sanitizedDocName}`;
        const { error: documentError } = await supabase.storage
          .from("request-documents")
          .upload(documentPath, documentFile);

        if (documentError) throw documentError;

        const { data: documentData } = supabase.storage
          .from("request-documents")
          .getPublicUrl(documentPath);
        
        documentUrls.push(documentData.publicUrl);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      
      const isCurrentUserApplicant = profile?.full_name && 
        data.applicant.toLowerCase().includes(profile.full_name.toLowerCase());
      
      const requestData = {
        request_number: requestNumber,
        request_date: data.request_date,
        description: data.description,
        status: data.status,
        priority: data.priority,
        applicant: data.applicant,
        applicant_user_id: isCurrentUserApplicant ? user.id : null,
        executor: data.executor || null,
        object_id: data.object_id || null,
        estimated_delivery_days: data.estimated_delivery_days || null,
        availability_delivery_time: data.availability_delivery_time || null,
        contractor: data.contractor || null,
        invoice_number: data.invoice_number || null,
        amount: data.amount ?? null,
        payment_percentage: data.payment_percentage,
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
        photo_url: photoUrls[0] || null,
        document_url: documentUrls[0] || null,
        photo_urls: photoUrls,
        document_urls: documentUrls,
        organization_id: currentOrgId,
        created_by: user.id,
      };

      const { data: newRequest, error } = await supabase
        .from("requests")
        .insert([requestData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Заявка создана",
      });

      // Send Telegram notification if auto-send is enabled
      if (newRequest) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("telegram_auto_send_on_create")
          .eq("id", currentOrgId)
          .single();
        
        if (orgData?.telegram_auto_send_on_create) {
          await notifyTelegram(newRequest.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });

      form.reset();
      setPhotoFiles([]);
      setDocumentFiles([]);
      clearDraft();
      
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        setInternalOpen(false);
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать заявку",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-scroll to focused input on mobile
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (isMobile) {
      setTimeout(() => {
        // Prevent unintended horizontal scrolling on mobile while keeping the field visible above the keyboard
        e.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }, 300);
    }
  };

  const formContent = (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5 sm:space-y-6"
        onFocus={handleInputFocus as any}
      >
        
        {/* 1. Context Block: Description + Comment */}
        <ContextSection 
          ref={descriptionRef}
          form={form} 
          draftSaveState={draftSaveState}
          autoFocus={true}
        />

        {/* 2. ERP — Stock check (before core params) */}
        <ErpSection
          form={form}
          currentOrgId={currentOrgId}
        />

        {/* 3. Core Params: Date, Object */}
        <CoreParamsSection
          form={form}
          objectsData={objectsData}
          currentOrgId={currentOrgId}
        />

        {/* 4. Status & Responsibles */}
        <StatusResponsiblesSection
          form={form}
          statuses={statuses}
          priorities={priorities}
          applicants={applicants}
          executors={executors}
          currentOrgId={currentOrgId}
        />

        {/* 5. Finance */}
        <FinanceSection form={form} />

        {/* 6. Logistics: Availability, TK, Dates, TTN */}
        <LogisticsSection
          form={form}
          recentTransportCompanies={recentTransportCompanies}
        />

        {/* 6. Additional (Collapsed by default): ZRS, Files */}
        <AdditionalSection
          form={form}
          formValues={formValues}
          objectsData={objectsData}
          photoFiles={photoFiles}
          setPhotoFiles={setPhotoFiles}
          documentFiles={documentFiles}
          setDocumentFiles={setDocumentFiles}
        />
      </form>
    </Form>
  );

  const desktopActions = (
    <div className="flex justify-end gap-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(false)}
        disabled={isSubmitting}
      >
        Отмена
      </Button>
      <Button type="submit" form={formId} disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Создать заявку
      </Button>
    </div>
  );

  const mobileActions = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(false)}
        disabled={isSubmitting}
        className="w-full"
      >
        Отмена
      </Button>
      <Button type="submit" form={formId} disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Создать
      </Button>
    </div>
  );

  // Exit warning dialog
  const exitWarningDialog = (
    <AlertDialog open={showExitWarning} onOpenChange={setShowExitWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Несохранённые изменения
          </AlertDialogTitle>
          <AlertDialogDescription>
            У вас есть несохранённые данные в форме. Если вы закроете форму, черновик будет сохранён локально и восстановлен при следующем открытии.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelClose}>
            Продолжить редактирование
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirmClose} className="bg-destructive hover:bg-destructive/90">
            Закрыть и сбросить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        {exitWarningDialog}
        <Drawer open={open} onOpenChange={handleOpenChange} dismissible={false}>
          <DrawerTrigger asChild>{children}</DrawerTrigger>
          <DrawerContent className="mt-0 h-[90dvh] max-h-[90dvh] w-full max-w-full overflow-hidden flex flex-col">
            <DrawerHeader className="text-left border-b pb-3 pt-3 flex-shrink-0 flex items-center justify-between">
              <DrawerTitle>Новая заявка</DrawerTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} className="h-8 w-8 p-0">
                ✕
              </Button>
            </DrawerHeader>
            <DrawerDescription className="sr-only">Заполните форму для создания заявки</DrawerDescription>
            <div 
              className="flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden p-3 pb-[calc(6rem+env(safe-area-inset-bottom))]"
            >
              {formContent}
            </div>
            <div className="shrink-0 border-t bg-background/95 backdrop-blur px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {mobileActions}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {exitWarningDialog}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая заявка</DialogTitle>
            <DialogDescription>
              Заполните форму для создания заявки
            </DialogDescription>
          </DialogHeader>
          {formContent}
          {desktopActions}
        </DialogContent>
      </Dialog>
    </>
  );
};
