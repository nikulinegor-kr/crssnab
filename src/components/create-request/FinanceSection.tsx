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
import { Banknote, ScanText, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface FinanceSectionProps {
  form: UseFormReturn<any>;
  suppliers?: Array<{ id: string; name: string }>;
  recentContractors?: string[];
  disabled?: boolean;
}

export const FinanceSection = ({ form, suppliers, recentContractors, disabled = false }: FinanceSectionProps) => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddContractor = async (name: string) => {
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
      name, organization_id: currentOrgId, created_by: user.id, category: "Другое", status: "Активный",
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

  return (
    <FormSectionCard 
      title="Финансы" 
      icon={<Banknote className="h-4 w-4 text-primary" />}
      className="border-primary/20"
      titleClassName="text-base font-semibold"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Recognize invoice button */}
        <div className="flex justify-end">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isRecognizing}
            className="h-8"
          >
            {isRecognizing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <ScanText className="h-3.5 w-3.5 mr-1" />
            )}
            Распознать счёт
          </Button>
        </div>

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
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:gap-3 items-end">
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
              {showInv2 && renderInvoiceRow("invoice_number_2", "amount_2", "Счёт №2", () => {
                form.setValue("invoice_number_2", "");
                form.setValue("amount_2", null);
                form.setValue("_showInv2" as any, false);
              })}
              {showInv3 && renderInvoiceRow("invoice_number_3", "amount_3", "Счёт №3", () => {
                form.setValue("invoice_number_3", "");
                form.setValue("amount_3", null);
                form.setValue("_showInv3" as any, false);
              })}

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
            </div>
          );
        })()}

        {/* Actual payment */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="payment_percent"
            render={({ field }) => {
              const val = field.value ?? 0;
              const statusLabel = val === 0 ? "Не оплачено" : val >= 100 ? "Оплачено" : "Частично оплачено";
              const statusColor = val === 0 ? "text-destructive" : val >= 100 ? "text-emerald-600" : "text-amber-600";
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
                  {underpaid && (
                    <p className="text-[11px] text-destructive">Недоплата: факт {val}% &lt; план {prepay}%</p>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <FormItem>
            <FormLabel className="text-xs">Статус оплаты</FormLabel>
            <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50 text-sm">
              {(() => {
                const val = form.watch("payment_percent") ?? 0;
                if (val === 0) return <span className="text-destructive font-medium">Не оплачено</span>;
                if (val >= 100) return <span className="text-emerald-600 font-medium">Оплачено</span>;
                return <span className="text-amber-600 font-medium">Частично ({val}%)</span>;
              })()}
            </div>
          </FormItem>
        </div>

        {/* Availability row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
    </FormSectionCard>
  );
};
