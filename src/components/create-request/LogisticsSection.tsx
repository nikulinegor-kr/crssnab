import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { FormSectionCard } from "./FormSectionCard";
import { Truck } from "lucide-react";

interface LogisticsSectionProps {
  form: UseFormReturn<any>;
  recentTransportCompanies: string[];
}

export const LogisticsSection = ({
  form,
  recentTransportCompanies,
}: LogisticsSectionProps) => {
  return (
    <FormSectionCard 
      title="Логистика" 
      icon={<Truck className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Transport company & Waybill - 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="transport_company"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Транспортная компания</FormLabel>
                <FormControl>
                  <ComboboxInput
                    value={field.value || ""}
                    onChange={field.onChange}
                    options={recentTransportCompanies.map(c => ({ value: c, label: c }))}
                    placeholder="Введите или выберите..."
                    searchPlaceholder="Поиск ТК..."
                    emptyMessage="Введите название вручную"
                    allowCustomValue={true}
                  />
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
                <FormLabel className="text-xs">Номер ТТН</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Трек-номер" 
                    className="h-9 min-w-0" 
                    title="Номер товарно-транспортной накладной"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Срок доставки (дней) & Dates - 3 columns */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="estimated_delivery_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Срок (дней)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    className="h-9 text-sm"
                    placeholder=""
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : null)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shipment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Дата отгрузки</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    className="h-9 min-w-0 text-sm" 
                    title="Когда отправят товар"
                    {...field} 
                  />
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
                <FormLabel className="text-xs">Дата доставки</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    className="h-9 min-w-0 text-sm" 
                    title="Ожидаемая дата получения"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </FormSectionCard>
  );
};
