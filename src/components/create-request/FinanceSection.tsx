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
}

export const FinanceSection = ({ form, suppliers, recentContractors }: FinanceSectionProps) => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Handler to add new contractor to suppliers table
  const handleAddContractor = async (name: string) => {
    if (!currentOrgId) {
      toast({
        title: "Ошибка",
        description: "Организация не выбрана",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Пользователь не авторизован",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("suppliers")
      .insert({
        name,
        organization_id: currentOrgId,
        created_by: user.id,
        category: "Другое",
        status: "Активный",
      });

    if (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить контрагента",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Контрагент добавлен",
      description: `"${name}" успешно добавлен в список`,
    });

    // Refresh suppliers list
    queryClient.invalidateQueries({ queryKey: ["suppliers", currentOrgId] });
  };

  // Handler to delete contractor
  const handleDeleteContractor = async (supplierId: string) => {
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplierId);

    if (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить контрагента",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Контрагент удалён",
    });

    queryClient.invalidateQueries({ queryKey: ["suppliers", currentOrgId] });
  };

  // Handler to edit contractor
  const handleEditContractor = async (supplierId: string, newName: string) => {
    const { error } = await supabase
      .from("suppliers")
      .update({ name: newName })
      .eq("id", supplierId);

    if (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить контрагента",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Контрагент обновлён",
    });

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

        {/* Invoice, Amount, Payment % - 3 columns */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Номер счета</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Сч. 123 от 24.01.26" 
                    className="h-9 select-all min-w-0 text-sm" 
                    title="Номер счета для оплаты"
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
                <FormLabel className="text-xs">Сумма (₽)</FormLabel>
                <FormControl>
                  <DecimalInput
                    placeholder=""
                    className="h-9 select-all min-w-0 text-sm"
                    title="Сумма счета в рублях"
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
                  <SelectContent className="pointer-events-auto">
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

        {/* Availability / Delivery time */}
        <FormField
          control={form.control}
          name="availability_delivery_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Наличие / Сроки поставки</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выбрать наличие" />
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
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSectionCard>
  );
};
