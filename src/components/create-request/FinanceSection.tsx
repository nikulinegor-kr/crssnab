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
import { FormSectionCard } from "./FormSectionCard";
import { ContractorSelect } from "@/components/ContractorSelect";
import { Banknote } from "lucide-react";
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

  return (
    <FormSectionCard 
      title="Финансы" 
      icon={<Banknote className="h-4 w-4 text-primary" />}
      className="border-primary/20"
      titleClassName="text-base font-semibold"
    >
      <div className="space-y-3 sm:space-y-4">
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

        {/* Invoice number, Amount, Payment status - 3 columns */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Номер счёта</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Сч. 123" 
                    className="h-9 select-all min-w-0 text-sm" 
                    disabled={disabled}
                    {...field} 
                  />
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

          <FormField
            control={form.control}
            name="payment_percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">% оплаты</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    className="h-9 select-all min-w-0 text-sm"
                    disabled={disabled}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Math.min(100, Math.max(0, parseInt(e.target.value, 10)));
                      field.onChange(isNaN(val as number) ? null : val);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
              name="estimated_delivery_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Срок (дней)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="кол-во дней"
                      className="h-9 select-all min-w-0 text-sm"
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
