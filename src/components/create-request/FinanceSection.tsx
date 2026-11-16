import { useState, useRef } from "react";
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
import { DecimalInput } from "@/components/ui/decimal-input";
import { Button } from "@/components/ui/button";
import { FormSectionCard } from "./FormSectionCard";
import { ContractorSelect } from "@/components/ContractorSelect";
import { Banknote, ScanText, Loader2, Plus, X, FileText, Upload, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { openStoredFile } from "@/lib/storageUrl";
import { requestFileName } from "@/lib/requestDocuments";
import { getInvoiceDeletePatch, getInvoiceResetPatch, getRequestInvoiceRequisites, hasInvoiceRequisites, type RequestInvoiceSlot } from "@/lib/requestInvoices";
import { RequestInvoiceRequisites } from "@/components/requests/RequestInvoiceActions";
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

interface FinanceSectionProps {
  form: UseFormReturn<any>;
  suppliers?: Array<{ id: string; name: string }>;
  recentContractors?: string[];
  disabled?: boolean;
  invoiceFile?: File | null;
  invoiceUrl?: string | null;
  onInvoiceSelected?: (file: File) => void;
  onRemoveInvoiceDocument?: () => void;
  defaultOpen?: boolean;
}

export const FinanceSection = ({
  form,
  suppliers,
  recentContractors,
  disabled = false,
  invoiceFile,
  invoiceUrl,
  onInvoiceSelected,
  onRemoveInvoiceDocument,
  defaultOpen = false,
}: FinanceSectionProps) => {
  const rawContractor = form.watch("contractor");
  const summaryContractor = suppliers?.find((x) => x.id === rawContractor)?.name || rawContractor;
  const summaryAmount = form.watch("amount");
  const summaryText = summaryContractor || summaryAmount
    ? [summaryContractor, summaryAmount != null && summaryAmount !== "" ? `${Number(summaryAmount).toLocaleString("ru-RU")} ₽` : null].filter(Boolean).join(" · ")
    : "Прикрепите счёт или заполните реквизиты вручную";
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [invoiceAction, setInvoiceAction] = useState<{ action: "reset" | "delete"; slot: RequestInvoiceSlot } | null>(null);
  const [documentDeleteOpen, setDocumentDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const handleAddContractor = async (name: string, extra?: { phone: string; nomenclature: string }) => {
    if (!currentOrgId) {
      toast({ title: "Ошибка", description: "Организация не выбрана", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Ошибка", description: "Пользователь не авторизован", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("suppliers").insert({
      name,
      organization_id: currentOrgId,
      created_by: user.id,
      category: "Другое",
      status: "Активный",
      phone: extra?.phone || null,
      nomenclature: extra?.nomenclature || null,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message || "Не удалось добавить контрагента", variant: "destructive" });
      throw error;
    }
    toast({ title: "Контрагент добавлен", description: `"${name}" успешно добавлен в список` });
    queryClient.invalidateQueries({ queryKey: ["suppliers", currentOrgId] });
  };

  const handleDeleteContractor = async (supplierId: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);
    if (error) {
      toast({ title: "Ошибка", description: error.message || "Не удалось удалить контрагента", variant: "destructive" });
      throw error;
    }
    toast({ title: "Контрагент удалён" });
    queryClient.invalidateQueries({ queryKey: ["suppliers", currentOrgId] });
  };

  const handleEditContractor = async (supplierId: string, newName: string) => {
    const { error } = await supabase.from("suppliers").update({ name: newName }).eq("id", supplierId);
    if (error) {
      toast({ title: "Ошибка", description: error.message || "Не удалось обновить контрагента", variant: "destructive" });
      throw error;
    }
    toast({ title: "Контрагент обновлён" });
    queryClient.invalidateQueries({ queryKey: ["suppliers", currentOrgId] });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRecognizeInvoice = async (file: File) => {
    setIsRecognizing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("recognize-invoice", {
        body: { file: base64, fileName: file.name, fileType: file.type, mode: "finance" },
      });
      if (error) throw error;

      let filled = 0;

      if (data?.contractor) {
        // Normalize full legal forms to abbreviations
        const { formatCompanyName } = await import("@/lib/companyFormat");
        const normalizedContractor = formatCompanyName(data.contractor);
        // Try to match supplier by name
        const match = suppliers?.find(s => 
          s.name.toLowerCase().includes(normalizedContractor.toLowerCase()) ||
          normalizedContractor.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) {
          form.setValue("contractor", match.id);
        } else {
          form.setValue("contractor", normalizedContractor);
        }
        filled++;
      }
      if (data?.invoice_number) {
        form.setValue("invoice_number", data.invoice_number);
        filled++;
      }
      if (data?.amount != null) {
        form.setValue("amount", data.amount);
        filled++;
      }

      if (filled > 0) {
        toast({ title: "Распознано", description: `Заполнено ${filled} полей из документа` });
      } else {
        toast({ title: "Не удалось распознать", description: "Данные не найдены в документе", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Ошибка распознавания", description: err.message || "Не удалось обработать документ", variant: "destructive" });
    } finally {
      setIsRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyInvoiceAction = () => {
    if (!invoiceAction) return;
    const patch = invoiceAction.action === "reset"
      ? getInvoiceResetPatch(invoiceAction.slot)
      : getInvoiceDeletePatch(invoiceAction.slot);
    Object.entries(patch).forEach(([key, value]) => form.setValue(key, value, { shouldDirty: true }));
    if (invoiceAction.action === "delete" && invoiceAction.slot > 1) {
      form.setValue(`_showInv${invoiceAction.slot}` as any, false, { shouldDirty: true });
    }
    setInvoiceAction(null);
  };

  return (
    <FormSectionCard 
      title="Счета и оплата"
      summary={summaryText}
      sectionId="req-sec-invoice"
      collapsible
      defaultCollapsed={!defaultOpen}
    >
      <div className="space-y-3 sm:space-y-4">
        <div className="request-finance-grid">
          <div className="request-finance-doc">
        {(invoiceFile || invoiceUrl) && (() => {
          const storageName = invoiceUrl ? decodeURIComponent(invoiceUrl.split("/").pop() || "Счёт") : "";
          const name = invoiceFile?.name || storageName.replace(/^\d+-/, "") || "Счёт";
          const format = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "ФАЙЛ";
          return (
            <div className="request-invoice-card">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="request-invoice-card__name">
                <div>{name}</div>
                <div className="mt-0.5 text-xs font-normal text-muted-foreground">{format}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2 text-primary"
                onClick={() => {
                  if (invoiceFile) {
                    const url = URL.createObjectURL(invoiceFile);
                    window.open(url, "_blank", "noopener,noreferrer");
                    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
                  } else if (invoiceUrl) {
                    void openStoredFile(invoiceUrl);
                  }
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть
              </Button>
              {invoiceUrl && onRemoveInvoiceDocument && (
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-destructive hover:text-destructive" onClick={() => setDocumentDeleteOpen(true)} disabled={disabled}>
                  <X className="h-3.5 w-3.5" />Удалить документ
                </Button>
              )}
            </div>
          );
        })()}
        {!(invoiceFile || invoiceUrl) && (
          <div className="request-invoice-card request-invoice-card--empty">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="request-invoice-card__name">
              <div>Счёт не прикреплён</div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">PDF, изображение или таблица</div>
            </div>
          </div>
        )}
        {/* Оба действия используют существующие обработчики файла и OCR. */}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleRecognizeInvoice(f);
            }}
          />
          <input
            ref={attachInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onInvoiceSelected?.(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isRecognizing}
            className="h-9"
          >
            {isRecognizing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <ScanText className="h-3.5 w-3.5 mr-1" />
            )}
            Распознать счёт
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => attachInputRef.current?.click()}
            disabled={disabled || !onInvoiceSelected}
            className="h-9"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Выбрать файл
          </Button>
        </div>

          </div>
          <div className="request-finance-fields min-w-0 space-y-3">

        {/* Contractor */}
        <FormField
          control={form.control}
          name="contractor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Контрагент</FormLabel>
              <FormControl>
                <ContractorSelect
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  options={[
                    ...(suppliers?.map(s => ({ value: s.id, label: s.name })) || []),
                    ...(recentContractors || [])
                      .filter(c => !suppliers?.some(s => s.name === c))
                      .map(c => ({ value: c, label: c })),
                  ]}
                  onAddNew={handleAddContractor}
                  onDelete={handleDeleteContractor}
                  onEdit={handleEditContractor}
                  placeholder="Выбрать или добавить..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Invoices (up to 3) + payment % */}
        {(() => {
          const inv2Filled = !!form.watch("invoice_number_2") || form.watch("amount_2") != null;
          const inv3Filled = !!form.watch("invoice_number_3") || form.watch("amount_3") != null;
          const showInv2 = inv2Filled || (form.watch("_showInv2") as boolean);
          const showInv3 = inv3Filled || (form.watch("_showInv3") as boolean);
          const a1 = Number(form.watch("amount") || 0);
          const a2 = Number(form.watch("amount_2") || 0);
          const a3 = Number(form.watch("amount_3") || 0);
          const total = a1 + a2 + a3;
          const multi = showInv2 || showInv3;

          const renderInvoiceRow = (
            numField: "invoice_number" | "invoice_number_2" | "invoice_number_3",
            amtField: "amount" | "amount_2" | "amount_3",
            label: string,
            onRemove?: () => void,
          ) => (
            <div className="request-mobile-stack grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
              <FormField
                control={form.control}
                name={numField}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{label}</FormLabel>
                    <FormControl>
                      <Input placeholder="Сч. 123" className="h-9 select-all min-w-0 text-sm" disabled={disabled} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={amtField}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Стоимость (₽)</FormLabel>
                    <FormControl>
                      <DecimalInput
                        placeholder=""
                        className="h-9 select-all min-w-0 text-sm"
                        disabled={disabled}
                        value={field.value ?? null}
                        onValueChange={(v) => field.onChange(v)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {onRemove ? (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} disabled={disabled} title="Удалить счёт">
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <div className="w-9" />
              )}
            </div>
          );

          return (
            <div className="space-y-3">
              {renderInvoiceRow("invoice_number", "amount", multi ? "Счёт №1" : "Номер счёта")}
              {showInv2 && renderInvoiceRow("invoice_number_2", "amount_2", "Счёт №2", () => setInvoiceAction({ action: "delete", slot: 2 }))}
              {showInv3 && renderInvoiceRow("invoice_number_3", "amount_3", "Счёт №3", () => setInvoiceAction({ action: "delete", slot: 3 }))}

              <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={disabled || !hasInvoiceRequisites(form.getValues(), 1)} onClick={() => setInvoiceAction({ action: "reset", slot: 1 })}>
                  Сбросить реквизиты
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" disabled={disabled || !hasInvoiceRequisites(form.getValues(), 1)} onClick={() => setInvoiceAction({ action: "delete", slot: 1 })}>
                  <X className="mr-1 h-3.5 w-3.5" />Удалить счёт
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2">
                {!showInv3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={disabled}
                    onClick={() => form.setValue((showInv2 ? "_showInv3" : "_showInv2") as any, true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Ещё счёт
                  </Button>
                )}
                {multi && (
                  <div className="ml-auto text-xs text-muted-foreground">
                    Итого: <span className="font-semibold text-foreground font-numeric">{total.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* Availability row */}
        <div className="request-mobile-stack grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <FormField
            control={form.control}
            name="availability_delivery_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Наличие</FormLabel>
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выбрать..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="В наличии">В наличии</SelectItem>
                    <SelectItem value="Под заказ">Под заказ</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("availability_delivery_time") === "Под заказ" && (
            <FormField
              control={form.control}
              name="order_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Заказ (дней)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="кол-во дней"
                      className="h-9 select-all min-w-0 text-sm"
                      title="Срок изготовления/поставки под заказ (не срок доставки ТК)"
                      disabled={disabled}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
          </div>
        </div>
        {/* Actual payment */}
        <div className="request-mobile-stack grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 request-payment-row">
              <FormField
                control={form.control}
                name="payment_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">% предоплаты</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(v === "" ? null : parseInt(v, 10))}
                      disabled={disabled}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="100">100%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

          <FormField
            control={form.control}
            name="payment_percent"
            render={({ field }) => {
              const val = field.value ?? 0;
              const prepay = form.watch("payment_percentage") ?? 0;
              const underpaid = prepay > 0 && val < prepay;
              return (
                <FormItem>
                  <FormLabel className="text-xs">Факт оплаты (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      className={cn("h-9 select-all min-w-0 text-sm", underpaid && "border-destructive")}
                      disabled={disabled}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.min(100, Math.max(0, parseInt(e.target.value, 10)));
                        field.onChange(isNaN(v as number) ? null : v);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <FormItem>
            <FormLabel className="text-xs">Статус оплаты</FormLabel>
            <div className="request-payment-status">
              {(() => {
                const val = form.watch("payment_percent") ?? 0;
                const color = val === 0 ? "bg-destructive" : val >= 100 ? "bg-success" : "bg-warning";
                const label = val === 0 ? "Не оплачено" : val >= 100 ? "Оплачено" : `Частично оплачено · ${val}%`;
                return (
                  <>
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color)} aria-hidden="true" />
                    <span className={cn(val === 0 ? "text-destructive" : val >= 100 ? "text-success" : "text-warning")}>{label}</span>
                  </>
                );
              })()}
            </div>
          </FormItem>
        </div>
        {Number(form.watch("payment_percentage") ?? 0) > 0 && Number(form.watch("payment_percent") ?? 0) < Number(form.watch("payment_percentage") ?? 0) && (
          <p className="request-payment-warning" role="alert">
            Недоплата: факт {Number(form.watch("payment_percent") ?? 0)}% &lt; план {Number(form.watch("payment_percentage") ?? 0)}%
          </p>
        )}

        <AlertDialog open={!!invoiceAction} onOpenChange={(open) => !open && setInvoiceAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {invoiceAction?.action === "reset" ? "Сбросить реквизиты основного счёта?" : `Удалить счёт №${invoiceAction?.slot ?? 1}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {invoiceAction?.action === "reset"
                  ? "Будут очищены только сумма, номер и контрагент. Дата, документы и другие счета сохранятся. Изменение применится при сохранении заявки."
                  : "Связанные документы и другие счета сохранятся. Изменение применится при сохранении заявки."}
              </AlertDialogDescription>
              {invoiceAction?.slot === 1 ? (
                <RequestInvoiceRequisites request={form.getValues()} />
              ) : invoiceAction ? (
                <div className="mt-3 text-left text-sm text-foreground">
                  Номер: {getRequestInvoiceRequisites(form.getValues(), invoiceAction.slot).invoiceNumber || "—"}<br />
                  Сумма: {getRequestInvoiceRequisites(form.getValues(), invoiceAction.slot).amount ?? "—"}
                </div>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={applyInvoiceAction}>{invoiceAction?.action === "reset" ? "Сбросить реквизиты" : "Удалить счёт"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={documentDeleteOpen} onOpenChange={setDocumentDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="mt-2 block break-words font-medium text-foreground">{invoiceUrl ? requestFileName(invoiceUrl) : "Документ"}</span>
                <span className="mt-1 block">Файл будет удалён из заявки при её сохранении. Реквизиты счёта сохранятся.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onRemoveInvoiceDocument?.(); setDocumentDeleteOpen(false); }}>Удалить документ</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FormSectionCard>
  );
};
