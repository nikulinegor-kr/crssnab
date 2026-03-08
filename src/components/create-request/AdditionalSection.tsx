import { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { FormSectionCard } from "./FormSectionCard";
import { MoreHorizontal, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface AdditionalSectionProps {
  form: UseFormReturn<any>;
  formValues: any;
  objectsData: Array<{ id: string; name: string }> | undefined;
  photoFiles: File[];
  setPhotoFiles: (files: File[]) => void;
  documentFiles: File[];
  setDocumentFiles: (files: File[]) => void;
  disabled?: boolean;
  existingPhotoUrls?: string[];
  onRemoveExistingPhoto?: (url: string) => void;
  existingDocumentUrls?: string[];
  onRemoveExistingDocument?: (url: string) => void;
}

export const AdditionalSection = ({
  form,
  formValues,
  objectsData,
  photoFiles,
  setPhotoFiles,
  documentFiles,
  setDocumentFiles,
  disabled = false,
  existingPhotoUrls,
  onRemoveExistingPhoto,
  existingDocumentUrls,
  onRemoveExistingDocument,
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
      <div className="space-y-3 sm:space-y-4">
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
            className="min-h-[80px] sm:min-h-[100px] bg-muted/50 font-mono text-xs"
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
        {!disabled ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MultiFileDropZone
            accept="image/*"
            files={photoFiles}
            onFilesChange={setPhotoFiles}
            existingUrls={existingPhotoUrls}
            onRemoveExisting={onRemoveExistingPhoto}
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
            existingUrls={existingDocumentUrls}
            onRemoveExisting={onRemoveExistingDocument}
            label="Документы (Счёт/КП)"
            hint="PDF, DOC, XLS до 10 МБ, макс. 10"
            icon="document"
            maxSizeMB={10}
            maxFiles={10}
          />
        </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Фото ({existingPhotoUrls?.length || 0})</Label>
            {existingPhotoUrls?.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                Фото {i + 1}
              </a>
            ))}
            {(!existingPhotoUrls || existingPhotoUrls.length === 0) && <p className="text-sm text-muted-foreground">Нет фото</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Документы ({existingDocumentUrls?.length || 0})</Label>
            {existingDocumentUrls?.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                Документ {i + 1}
              </a>
            ))}
            {(!existingDocumentUrls || existingDocumentUrls.length === 0) && <p className="text-sm text-muted-foreground">Нет документов</p>}
          </div>
        </div>
        )}
      </div>
    </FormSectionCard>
  );
};
