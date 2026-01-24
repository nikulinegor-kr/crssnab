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
import { ContractorSelect } from "@/components/ContractorSelect";
import { ComboboxInput } from "@/components/ui/combobox-input";
import { FormSectionCard } from "./FormSectionCard";
import { Truck } from "lucide-react";

interface LogisticsSectionProps {
  form: UseFormReturn<any>;
  suppliers: Array<{ id: string; name: string }> | undefined;
  recentContractors: string[];
  recentTransportCompanies: string[];
}

export const LogisticsSection = ({
  form,
  suppliers,
  recentContractors,
  recentTransportCompanies,
}: LogisticsSectionProps) => {
  return (
    <FormSectionCard 
      title="Логистика" 
      icon={<Truck className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-4">
        {/* Contractor & Availability row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      ...recentContractors
                        .filter(c => !suppliers?.some(s => s.name === c))
                        .map(c => ({ value: c, label: c })),
                    ]}
                    placeholder="Выбрать или ввести..."
                  />
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

        {/* Transport company & Waybill */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <Input placeholder="№ ТТН" className="h-9" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="estimated_delivery_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Срок доставки (дней)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    className="h-9"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
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
                  <Input type="date" className="h-9" {...field} />
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
                  <Input type="date" className="h-9" {...field} />
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
