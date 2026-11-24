import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { FormSectionCard } from "./FormSectionCard";
import { MoreHorizontal, Copy, FileText, Send, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readPreparedInvoice, insertZrsIntoPreparedInvoice } from "@/lib/invoicePdf";
import { recognizeInvoiceFile } from "@/lib/recognizeInvoice";
import { resolveSignedUrl } from "@/lib/storageUrl";
import { requestFileName } from "@/lib/requestDocuments";
import { saveImageFile } from "@/lib/saveImage";
import { z } from "zod";
import { revealRequestErrors, validateRequiredZrsFields } from "./requiredZrsFields";
import { buildRequestZrsLines } from "@/lib/requestZrs";

interface AdditionalSectionProps {
  form: UseFormReturn<any>;
  formValues: any;
  objectsData: Array<{ id: string; name: string }> | undefined;
  photoFiles: File[];
  setPhotoFiles: (files: File[]) => void;
  documentFiles: File[];
  setDocumentFiles: Dispatch<SetStateAction<File[]>>;
  disabled?: boolean;
  existingPhotoUrls?: string[];
  onRemoveExistingPhoto?: (url: string) => void;
  existingDocumentUrls?: string[];
  onRemoveExistingDocument?: (url: string) => void;
  organizationId?: string | null;
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
  organizationId,
}: AdditionalSectionProps) => {
  const { toast } = useToast();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [lastZrsFile, setLastZrsFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const localSources = documentFiles.filter(file => /\.pdf$/i.test(file.name) && !/-ZRS\.pdf$/i.test(file.name)).map(file => ({ key: `local:${file.name}:${file.lastModified}`, name: file.name, file, url: "" }));
  const storedSources = [...new Set(existingDocumentUrls ?? [])].filter(url => /\.pdf$/i.test(requestFileName(url)) && !/-ZRS\.pdf$/i.test(requestFileName(url))).map(url => ({ key: url, name: requestFileName(url), file: null as File | null, url }));
  const allSources = [...localSources, ...storedSources];
  const preparedNames = new Set(allSources.filter(source => /\.prepared\.pdf$/i.test(source.name)).map(source => source.name.replace(/\.prepared\.pdf$/i, ".pdf")));
  const sources = allSources.filter(source => !preparedNames.has(source.name));
  const sourceKey = sources.some(source => source.key === selectedInvoice) ? selectedInvoice : sources.length === 1 ? sources[0].key : "";

  const handleCopyZRS = async () => {
    const zrsText = getZrsLines().join("\n");
    
    try {
      await navigator.clipboard.writeText(zrsText);
      toast({ title: "Скопировано", description: "Текст ЗРС скопирован в буфер обмена" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать текст", variant: "destructive" });
    }
  };

  const getZrsLines = (values = form.getValues()) => buildRequestZrsLines(
    values,
    objectsData?.find(o => o.id === values.object_id)?.name,
  );

  const insertIntoFile = async (originalFile: File, alreadyAttached = true) => {
    if (disabled || isPreparing) return;
    const validation = z.object({}).passthrough().superRefine((values, context) => validateRequiredZrsFields(values, context, true)).safeParse(form.getValues());
    if (!validation.success) {
      const errors = Object.fromEntries(validation.error.issues.map(issue => {
        const field = String(issue.path[0]);
        const error = { type: "required", message: issue.message };
        form.setError(field, error);
        return [field, error];
      }));
      revealRequestErrors(errors);
      toast({ title: "Заполните данные заявки и счёта", description: "Проверьте поля со звёздочкой перед вставкой ЗРС.", variant: "destructive" });
      return;
    }
    setIsPreparing(true);
    try {
      let prepared = originalFile;
      let bytes = new Uint8Array(await prepared.arrayBuffer());
      if (!await readPreparedInvoice(bytes)) {
        const result = await recognizeInvoiceFile(originalFile, "all");
        if (!result.preparedFile) throw new Error(result.preparationMessage || "Не удалось подготовить счёт для ЗРС");
        prepared = result.preparedFile;
        bytes = new Uint8Array(await prepared.arrayBuffer());
      }
      const response = await fetch('/fonts/Roboto-Regular.ttf');
      if (!response.ok) throw new Error("Не удалось загрузить шрифт ЗРС");
      const modifiedPdf = await insertZrsIntoPreparedInvoice(bytes, getZrsLines(), new Uint8Array(await response.arrayBuffer()));
      const sourceName = formValues.description || "Заявка";
      const safeName = String(sourceName).replace(/[\\/:*?"<>|\r\n\t]/g, "").replace(/\s+/g, " ").trim().slice(0,80) || "Заявка";
      const modifiedFile = new File([modifiedPdf as BlobPart], `${safeName || "Заявка"}-ZRS.pdf`, { type: "application/pdf" });
      // К заявке прикрепляем только итоговый PDF с ЗРС: оригинал и промежуточный prepared-файл не нужны.
      setDocumentFiles(current => [...current.filter(file => file.name !== originalFile.name && !/\.prepared\.pdf$/i.test(file.name) && file.name !== modifiedFile.name), modifiedFile]);
      setLastZrsFile(modifiedFile);
      await saveImageFile(modifiedFile, "Счёт с ЗРС");
      toast({ title: "Готово", description: "ЗРС вставлена после номенклатуры и итогов на последнем листе. Файл готов к сохранению" });
    } catch (err) {
      toast({ title: "Не удалось вставить ЗРС", description: err instanceof Error ? err.message : "Не удалось обработать PDF", variant: "destructive" });
    } finally { setIsPreparing(false); }
  };

  const handleInsertIntoInvoice = async () => {
    const fields = ["description", "applicant", "applicant_justification", "priority", "availability_delivery_time", "estimated_delivery_days", "payment_percentage", "executor"];
    if (!await form.trigger(fields)) {
      revealRequestErrors(Object.fromEntries(fields.map(name => [name, form.getFieldState(name).error])));
      toast({ title: "Заполните обязательные поля ЗРС", description: "Проверьте поля со звёздочкой в заявке, счетах и логистике.", variant: "destructive" });
      return;
    }
    if (!sources.length) { pdfInputRef.current?.click(); return; }
    const source = sources.find(item => item.key === sourceKey);
    if (!source) { toast({ title: "Выберите счёт", description: "В заявке несколько счетов — укажите нужный файл" }); return; }
    try {
      if (source.file) await insertIntoFile(source.file);
      else {
        setIsPreparing(true);
        const response = await fetch(await resolveSignedUrl(source.url));
        if (!response.ok) throw new Error("Не удалось загрузить прикреплённый счёт");
        const file = new File([await response.blob()], source.name, { type: "application/pdf" });
        setIsPreparing(false);
        await insertIntoFile(file);
      }
    } catch (err) {
      setIsPreparing(false);
      toast({ title: "Ошибка", description: err instanceof Error ? err.message : "Не удалось открыть счёт", variant: "destructive" });
    }
  };

  const handlePdfFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await insertIntoFile(file, false);
  };

  const handleSendToMax = async () => {
    if (!lastZrsFile || !organizationId) return;
    setIsSending(true);
    try {
      // Convert file to base64 (avoids storage RLS issues for unsaved requests)
      const arrayBuffer = await lastZrsFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const file_base64 = btoa(binary);

      const zrsText = getZrsLines().join("\n");

      const { error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          action: "send_zrs_document",
          organization_id: organizationId,
          file_base64,
          file_mime: lastZrsFile.type || "application/pdf",
          file_name: lastZrsFile.name,
          caption: `📋 ЗРС — Счёт\n\n${zrsText}`,
        },
      });
      if (error) throw error;
      toast({ title: "Отправлено в Макс", description: "Счёт с ЗРС повторно отправлен в группу «Макс СахаРесурс | Поставка ТМЦ»" });
    } catch (err) {
      console.error("Send ZRS error:", err);
      toast({ title: "Ошибка отправки", description: "Не удалось отправить счёт в Макс", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };


  return (
    <FormSectionCard 
      title="ЗРС"
      summary="Сводка заявки для согласования"
      sectionId="req-sec-zrs"
      icon={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
      collapsible
      defaultCollapsed={false}
    >
      <div className="space-y-3 sm:space-y-4">
        {/* ZRS Summary */}
        <div className="space-y-2">
          <div className="request-zrs-toolbar">
            <Label className="text-xs">ЗРС (сводка заявки)</Label>
            <div className="request-zrs-actions">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfFileSelected}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInsertIntoInvoice}
                disabled={disabled || isPreparing}
                className="h-7"
              >
                {isPreparing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                {isPreparing ? "Подготовка счёта…" : "Вставить ЗРС"}
              </Button>
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
              {lastZrsFile && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void saveImageFile(lastZrsFile, "Счёт с ЗРС")}
                    className="h-7"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Скачать PDF
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSendToMax}
                    disabled={isSending}
                    className="h-7"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {isSending ? "Отправка..." : "Отправить в Макс"}
                  </Button>
                </>
              )}
            </div>
          </div>
          {sources.length > 1 && <label className="block text-sm">Счёт для ЗРС
            <select className="mt-1 w-full min-w-0 rounded-xl border bg-white p-2 text-base" aria-label="Счёт для ЗРС" value={sourceKey} disabled={disabled || isPreparing} onChange={event => setSelectedInvoice(event.target.value)}>
              <option value="">Выберите счёт</option>
              {sources.map(source => <option key={source.key} value={source.key}>{source.name}</option>)}
            </select>
          </label>}
          <p className="text-xs text-muted-foreground">{sources.length ? "Используется прикреплённый счёт. Оригинал сохраняется, ЗРС добавляется после всех позиций и итогов." : "Прикрепите и распознайте счёт в разделе «Счета», либо выберите PDF кнопкой «Вставить ЗРС»."}</p>
          <div className="request-zrs-preview" aria-label="Предпросмотр ЗРС">
            {getZrsLines().map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>



      </div>
    </FormSectionCard>
  );
};
