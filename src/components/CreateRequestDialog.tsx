import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { FileDropZone } from "@/components/FileDropZone";
import { useRequestDraft } from "@/hooks/useRequestDraft";
import { useContractorSuggestions } from "@/hooks/useContractorSuggestions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Loader2, Upload, X, Image, FileText, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
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

interface CreateRequestDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CreateRequestDialog = ({ children, open: externalOpen, onOpenChange }: CreateRequestDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const isMobile = useIsMobile();
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const { recentContractors, recentTransportCompanies } = useContractorSuggestions();

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

  const statuses = statusesData?.map((s) => s.name) || [];
  const priorities = prioritiesData?.map((p) => p.name) || [];

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      request_date: new Date().toISOString().split("T")[0],
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
      payment_percentage: 0,
      shipment_date: "",
      delivery_date: "",
      transport_company: "",
      waybill_number: "",
      comments: "",
    },
  });

  const formValues = form.watch();
  
  // Auto-save draft
  const { clearDraft, hasDraft } = useRequestDraft(
    formValues as Record<string, unknown>,
    (values) => {
      Object.entries(values).forEach(([key, value]) => {
        form.setValue(key as keyof RequestFormData, value as never);
      });
    },
    open
  );

  const onSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true);
    try {
      // Check if organization is selected
      if (!currentOrgId) {
        toast({
          title: "Ошибка",
          description: "Выберите организацию",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Get current user
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

      // Generate request number based on date
      const date = new Date(data.request_date);
      const requestNumber = `REQ-${date.getFullYear()}-${Date.now()}`;

      let photoUrl = null;
      let documentUrl = null;

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
        const photoPath = `${requestNumber}/${Date.now()}-${sanitizedPhotoName}`;
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
        const documentPath = `${requestNumber}/${Date.now()}-${sanitizedDocName}`;
        const { error: documentError } = await supabase.storage
          .from("request-documents")
          .upload(documentPath, documentFile);

        if (documentError) throw documentError;

        const { data: documentData } = supabase.storage
          .from("request-documents")
          .getPublicUrl(documentPath);
        
        documentUrl = documentData.publicUrl;
      }

      // Get current user's profile to check if they are the applicant
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      
      // Set applicant_user_id if the applicant matches the current user's name
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
        amount: data.amount || 0,
        payment_percentage: data.payment_percentage,
        shipment_date: data.shipment_date || null,
        delivery_date: data.delivery_date || null,
        transport_company: data.transport_company || null,
        waybill_number: data.waybill_number || null,
        comments: data.comments || null,
        photo_url: photoUrl,
        document_url: documentUrl,
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

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });

      form.reset();
      setPhotoFile(null);
      setDocumentFile(null);
      clearDraft();
      handleOpenChange(false);
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


  const formContent = (
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
                      <Input type="date" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormControl>
                      <ComboboxInput
                        value={field.value}
                        onChange={field.onChange}
                        options={applicants.map(a => ({ value: a.id, label: a.name }))}
                        placeholder="Введите или выберите..."
                        searchPlaceholder="Поиск заявителя..."
                        emptyMessage="Введите имя вручную"
                        allowCustomValue={true}
                      />
                    </FormControl>
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
                    <FormControl>
                      <ComboboxInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={executors.map(e => ({ value: e.id, label: e.name }))}
                        placeholder="Введите или выберите..."
                        searchPlaceholder="Поиск исполнителя..."
                        emptyMessage="Введите имя вручную"
                        allowCustomValue={true}
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
                name="object_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Объект</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
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

              <FormField
                control={form.control}
                name="estimated_delivery_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ориентировочный срок доставки (дней)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Введите кол-во дней"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
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
                name="contractor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контрагент</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={[
                          ...(suppliers?.map(s => ({ value: s.name, label: s.name })) || []),
                          ...recentContractors
                            .filter(c => !suppliers?.some(s => s.name === c))
                            .map(c => ({ value: c, label: c }))
                        ]}
                        placeholder="Введите или выберите..."
                        searchPlaceholder="Поиск контрагента..."
                        emptyMessage="Введите название вручную"
                        allowCustomValue={true}
                      />
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
                    <div className="flex gap-2">
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[140px]">
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
                      <FormControl>
                        <Input 
                          placeholder="или введите сроки" 
                          className="flex-1"
                          {...field} 
                        />
                      </FormControl>
                    </div>
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
                      <Input placeholder="№ 123" {...field} />
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
                    <div className="flex gap-2">
                      <Select
                        value={field.value?.toString() || "0"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                          <SelectItem value="20">20%</SelectItem>
                          <SelectItem value="30">30%</SelectItem>
                          <SelectItem value="40">40%</SelectItem>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="60">60%</SelectItem>
                          <SelectItem value="70">70%</SelectItem>
                          <SelectItem value="80">80%</SelectItem>
                          <SelectItem value="90">90%</SelectItem>
                          <SelectItem value="100">100%</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="введите"
                          className="flex-1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                    </div>
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
                      <Input type="date" {...field} />
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
                      <Input type="date" {...field} />
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
                      <ComboboxInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={recentTransportCompanies.map(c => ({ value: c, label: c }))}
                        placeholder="Введите или выберите..."
                        searchPlaceholder="Поиск ТК..."
                        emptyMessage="Введите название вручную"
                        allowCustomValue={true}
                      />
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
                      <Input placeholder="№ ТТН" {...field} />
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
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ЗРС - автоматически заполняемое поле */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ЗРС (сводка заявки)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const zrsText = `Объект: ${objectsData?.find(o => o.id === formValues.object_id)?.name || "-"}
Заявка: ${formValues.description || "-"}
Заявитель: ${formValues.applicant || "-"}
Приоритет: ${formValues.priority || "-"}
Наличие: ${formValues.availability_delivery_time || "-"}
Срок доставки: ${formValues.estimated_delivery_days ? `${formValues.estimated_delivery_days} дн.` : "-"}
Оплата: ${formValues.payment_percentage}%
Исполнил: ${formValues.executor || "-"}`;
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
                value={`Объект: ${objectsData?.find(o => o.id === formValues.object_id)?.name || "-"}
Заявка: ${formValues.description || "-"}
Заявитель: ${formValues.applicant || "-"}
Приоритет: ${formValues.priority || "-"}
Наличие: ${formValues.availability_delivery_time || "-"}
Срок доставки: ${formValues.estimated_delivery_days ? `${formValues.estimated_delivery_days} дн.` : "-"}
Оплата: ${formValues.payment_percentage}%
Исполнил: ${formValues.executor || "-"}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileDropZone
                accept="image/*"
                file={photoFile}
                onFileChange={setPhotoFile}
                label="Фото заявки"
                hint="JPG, PNG, WEBP до 5 МБ"
                icon="image"
                maxSizeMB={5}
              />

              <FileDropZone
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                file={documentFile}
                onFileChange={setDocumentFile}
                label="Документ (Счёт/КП)"
                hint="PDF, DOC, DOCX, XLS, XLSX до 10 МБ"
                icon="document"
                maxSizeMB={10}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать заявку
              </Button>
            </div>
          </form>
        </Form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left border-b pb-4">
            <DrawerTitle>Создать новую заявку</DrawerTitle>
            <DrawerDescription>
              Заполните форму для создания новой заявки
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать новую заявку</DialogTitle>
          <DialogDescription>
            Заполните форму для создания новой заявки в системе
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};
