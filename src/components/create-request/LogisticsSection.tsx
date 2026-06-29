import { useEffect, useState } from "react";
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
import { Truck, Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestShipments } from "@/hooks/useRequestShipments";
import { RequestShipmentsPanel } from "@/components/requests/RequestShipmentsPanel";

interface LogisticsSectionProps {
  form: UseFormReturn<any>;
  recentTransportCompanies: string[];
  disabled?: boolean;
  requestId?: string;
  organizationId?: string | null;
}

export const LogisticsSection = ({
  form,
  recentTransportCompanies,
  disabled = false,
  requestId,
  organizationId,
}: LogisticsSectionProps) => {
  const { data: existingShipments = [] } = useRequestShipments(requestId);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [autoApplied, setAutoApplied] = useState(false);

  // Auto-switch to "multi" if request already has 2+ shipments
  useEffect(() => {
    if (!autoApplied && requestId && existingShipments.length >= 2) {
      setMode("multi");
      setAutoApplied(true);
    }
  }, [autoApplied, requestId, existingShipments.length]);

  return (
    <FormSectionCard
      title="Логистика"
      icon={<Truck className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Delivery type toggle */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Тип доставки</span>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multi")}>
            <TabsList className="h-8">
              <TabsTrigger type="button" value="single" className="text-xs px-3" disabled={disabled}>
                Обычная доставка
              </TabsTrigger>
              <TabsTrigger type="button" value="multi" className="text-xs px-3" disabled={disabled}>
                Несколько перевозок
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === "single" ? (
          <>
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
                        disabled={disabled}
                        options={recentTransportCompanies.map((c) => ({ value: c, label: c }))}
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
                        disabled={disabled}
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
                        disabled={disabled}
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
                name="delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Дата доставки</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 min-w-0 text-sm"
                        title="Ожидаемая дата получения"
                        disabled={disabled}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        ) : requestId && organizationId ? (
          <RequestShipmentsPanel
            requestId={requestId}
            organizationId={organizationId}
            canEdit={!disabled}
          />
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Сначала сохраните заявку, после чего здесь появится возможность добавлять
              перевозки. Каждая перевозка содержит свой список материалов, водителя, ТТН и
              даты.
            </div>
          </div>
        )}
      </div>
    </FormSectionCard>
  );
};
