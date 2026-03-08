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
import { Banknote } from "lucide-react";

interface FinanceSectionProps {
  form: UseFormReturn<any>;
  disabled?: boolean;
}

export const FinanceSection = ({ form, disabled = false }: FinanceSectionProps) => {
  return (
    <FormSectionCard 
      title="Финансы" 
      icon={<Banknote className="h-4 w-4 text-primary" />}
      className="border-primary/20"
      titleClassName="text-base font-semibold"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Invoice number & Invoice date - 2 columns */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
            name="invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Дата счёта</FormLabel>
                <FormControl>
                  <Input 
                    type="date"
                    className="h-9 min-w-0 text-sm" 
                    disabled={disabled}
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Amount & Payment status - 2 columns */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
            name="payment_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Статус оплаты</FormLabel>
                <Select
                  value={field.value || "Не выставлен"}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Не выставлен">Не выставлен</SelectItem>
                    <SelectItem value="Счёт выставлен">Счёт выставлен</SelectItem>
                    <SelectItem value="Оплачен">Оплачен</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </FormSectionCard>
  );
};
