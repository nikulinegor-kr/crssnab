import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Plus } from "lucide-react";
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
import { Loader2, Upload, X, Image, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    status: string;
    priority: string;
    executor?: string;
    category: string;
    reasoning: string;
  } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [isAddingApplicant, setIsAddingApplicant] = useState(false);
  const [newApplicantName, setNewApplicantName] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();

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

      const requestData = {
        request_number: requestNumber,
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

  const handleAiAnalysis = async () => {
    const description = form.getValues("description");
    
    if (!description || description.trim().length < 10) {
      toast({
        title: "Недостаточно данных",
        description: "Введите более подробное описание заявки для анализа",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrgId) {
      toast({
        title: "Ошибка",
        description: "Организация не выбрана",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAiSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-request", {
        body: {
          description,
          organizationId: currentOrgId,
        },
      });

      if (error) throw error;

      setAiSuggestion(data);
      
      // Применяем рекомендации к форме
      if (data.status) {
        form.setValue("status", data.status);
      }
      if (data.priority) {
        form.setValue("priority", data.priority);
      }
      if (data.executor) {
        form.setValue("executor", data.executor);
      }

      toast({
        title: "Анализ завершён",
        description: "AI предложил рекомендации для заявки",
      });
    } catch (error: any) {
      console.error("AI analysis error:", error);
      toast({
        title: "Ошибка анализа",
        description: error.message || "Не удалось выполнить AI анализ",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Описание заявки *</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiAnalysis}
                      disabled={isAnalyzing || !field.value || field.value.trim().length < 10}
                      className="gap-2"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      AI Помощник
                    </Button>
                  </div>
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

            {aiSuggestion && (
              <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Рекомендации AI
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Категория:</span> {aiSuggestion.category}</p>
                  <p><span className="font-medium">Статус:</span> {aiSuggestion.status}</p>
                  <p><span className="font-medium">Приоритет:</span> {aiSuggestion.priority}</p>
                  {aiSuggestion.executor && (
                    <p><span className="font-medium">Исполнитель:</span> {aiSuggestion.executor}</p>
                  )}
                  <p className="text-muted-foreground italic mt-2">{aiSuggestion.reasoning}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="applicant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Заявитель *</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      
                      <Dialog open={isAddingApplicant} onOpenChange={setIsAddingApplicant}>
                        <DialogTrigger asChild>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            className="shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Добавить заявителя</DialogTitle>
                            <DialogDescription>
                              Создайте нового заявителя для быстрого выбора
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="applicant-name">ФИО заявителя</Label>
                              <Input
                                id="applicant-name"
                                value={newApplicantName}
                                onChange={(e) => setNewApplicantName(e.target.value)}
                                placeholder="Введите ФИО"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsAddingApplicant(false);
                                setNewApplicantName("");
                              }}
                            >
                              Отмена
                            </Button>
                            <Button
                              type="button"
                              onClick={async () => {
                                if (!newApplicantName.trim()) {
                                  toast({
                                    title: "Ошибка",
                                    description: "Введите ФИО заявителя",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                try {
                                  const { error } = await supabase
                                    .from("request_participants")
                                    .insert({
                                      name: newApplicantName.trim(),
                                      organization_id: currentOrgId || "",
                                      participant_type: "applicant",
                                      is_active: true,
                                    });

                                  if (error) throw error;

                                  toast({
                                    title: "Успешно",
                                    description: "Заявитель добавлен",
                                  });

                                  // Обновляем список участников
                                  queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                                  
                                  // Выбираем нового заявителя
                                  field.onChange(newApplicantName.trim());
                                  
                                  setIsAddingApplicant(false);
                                  setNewApplicantName("");
                                } catch (error) {
                                  console.error("Error adding applicant:", error);
                                  toast({
                                    title: "Ошибка",
                                    description: "Не удалось добавить заявителя",
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
                name="executor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Исполнитель</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <div className="flex gap-2">
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Выбрать" />
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
                              <Label htmlFor="supplier-name">Название</Label>
                              <Input
                                id="supplier-name"
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
                                      organization_id: currentOrgId || "",
                                      created_by: userData.user?.id,
                                      status: "Активный",
                                      category: "Другое",
                                    });

                                  if (error) throw error;

                                  toast({
                                    title: "Успешно",
                                    description: "Контрагент добавлен",
                                  });

                                  // Обновляем список контрагентов
                                  queryClient.invalidateQueries({ queryKey: ["suppliers"] });
                                  
                                  // Выбираем нового контрагента
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
                      
                      <FormControl>
                        <Input 
                          placeholder="или введите название" 
                          className="flex-1"
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
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
                      <Input placeholder="ТК Компания" {...field} />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Фото заявки</Label>
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
              </div>

              <div className="space-y-2">
                <Label>Документ (Счёт/КП)</Label>
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
              </div>
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
