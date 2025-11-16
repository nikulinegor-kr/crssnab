import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
}

export const CreateRequestDialog = ({ children }: CreateRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();

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

      // Upload photo if selected
      if (photoFile) {
        const photoPath = `${requestNumber}/${Date.now()}-${photoFile.name}`;
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
        const documentPath = `${requestNumber}/${Date.now()}-${documentFile.name}`;
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

      // Send Telegram notification
      if (newRequest) {
        await notifyTelegram(newRequest.id);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-stats"] });

      form.reset();
      setPhotoFile(null);
      setDocumentFile(null);
      setOpen(false);
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

  const statuses = ["Новая заявка", "На согласовании", "КП", "Счёт", "В работе", "В пути", "Доставлено в ТК", "Доставлено", "Выполнено"];
  const priorities = ["Аварийно", "Планово", "Приоритетно"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать новую заявку</DialogTitle>
          <DialogDescription>
            Заполните форму для создания новой заявки в системе
          </DialogDescription>
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
                      <Input placeholder="Иванов И.И." {...field} />
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
                      <Input placeholder="Петров П.П." {...field} />
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
                      <Input placeholder="ООО Компания" {...field} />
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
                      <Input placeholder="В наличии / 2 недели" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                onClick={() => setOpen(false)}
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
      </DialogContent>
    </Dialog>
  );
};
