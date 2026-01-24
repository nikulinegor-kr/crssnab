import { UseFormReturn } from "react-hook-form";
import {
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { FormSectionCard } from "./FormSectionCard";
import { MoreHorizontal, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdditionalSectionProps {
  form: UseFormReturn<any>;
  formValues: any;
  objectsData: Array<{ id: string; name: string }> | undefined;
  photoFiles: File[];
  setPhotoFiles: (files: File[]) => void;
  documentFiles: File[];
  setDocumentFiles: (files: File[]) => void;
}

export const AdditionalSection = ({
  form,
  formValues,
  objectsData,
  photoFiles,
  setPhotoFiles,
  documentFiles,
  setDocumentFiles,
}: AdditionalSectionProps) => {
  const { toast } = useToast();

  const handleCopyZRS = async () => {
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
  };

  return (
    <FormSectionCard 
      title="Дополнительно" 
      icon={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
      collapsible
      defaultCollapsed
    >
      <div className="space-y-4">
        {/* Financial row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Номер счета</FormLabel>
                <FormControl>
                  <Input placeholder="№ 123" className="h-9" {...field} />
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
                <FormLabel className="text-xs">Сумма (₽)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="h-9"
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
                <FormLabel className="text-xs">Оплата (%)</FormLabel>
                <Select
                  value={field.value?.toString() || "0"}
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ZRS Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">ЗРС (сводка заявки)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyZRS}
              className="h-7"
            >
              <Copy className="h-3 w-3 mr-1" />
              Копировать
            </Button>
          </div>
          <Textarea
            readOnly
            className="min-h-[100px] bg-muted/50 font-mono text-xs"
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

        {/* Files */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MultiFileDropZone
            accept="image/*"
            files={photoFiles}
            onFilesChange={setPhotoFiles}
            label="Фото заявки"
            hint="JPG, PNG, WEBP до 5 МБ, макс. 10"
            icon="image"
            maxSizeMB={5}
            maxFiles={10}
          />

          <MultiFileDropZone
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            files={documentFiles}
            onFilesChange={setDocumentFiles}
            label="Документы (Счёт/КП)"
            hint="PDF, DOC, XLS до 10 МБ, макс. 10"
            icon="document"
            maxSizeMB={10}
            maxFiles={10}
          />
        </div>
      </div>
    </FormSectionCard>
  );
};
