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
import { hasAddedInvoice } from "./requiredZrsFields";
import { FormSectionCard } from "./FormSectionCard";
import { Truck, Info, Boxes } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequestShipments } from "@/hooks/useRequestShipments";
import { RequestShipmentsPanel } from "@/components/requests/RequestShipmentsPanel";
import { RecognizeWaybillButton } from "@/components/requests/RecognizeWaybillButton";

interface LogisticsSectionProps {
  hasInvoiceFile?: boolean;
  form: UseFormReturn<any>;
  recentTransportCompanies: string[];
  disabled?: boolean;
  requestId?: string;
  organizationId?: string | null;
}

export const LogisticsSection = ({
  form,
  hasInvoiceFile = false,
  recentTransportCompanies,
  disabled = false,
  requestId,
  organizationId,
}: LogisticsSectionProps) => {
  const invoiceRequired = hasAddedInvoice(form.watch(), hasInvoiceFile);
  const datesRequired = form.watch("status") === "В пути";
  const { data: existingShipments = [] } = useRequestShipments(requestId);
  const [selectedMode, setSelectedMode] = useState<"carrier" | "dedicated">();
  useEffect(() => setSelectedMode(undefined), [requestId]);
  const savedMode = existingShipments.length > 0 && existingShipments.every(shipment => shipment.shipment_mode === "dedicated")
    ? "dedicated" : "carrier";
  const mode = selectedMode ?? savedMode;

  return (
    <FormSectionCard
      title="Логистика"
      summary="Перевозчик, ТТН и даты"
      sectionId="req-sec-logistics"
      collapsible
      defaultCollapsed
    >
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Тип доставки</span>
        <Tabs value={mode} onValueChange={(value) => setSelectedMode(value as typeof mode)}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger type="button" value="carrier" className="min-h-9 px-3 text-xs">Транспортная компания</TabsTrigger>
            <TabsTrigger type="button" value="dedicated" className="min-h-9 px-3 text-xs">Машины, контейнеры и вагоны</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="sm:max-w-64">
        <FormField
          control={form.control}
          name="estimated_delivery_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Срок доставки (дней){invoiceRequired && " *"}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  step="1"
                  className="h-9 min-w-0 text-sm"
                  disabled={disabled}
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="shipment_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Дата отгрузки{datesRequired && " *"}</FormLabel>
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
              <FormLabel className="text-xs">Дата доставки{datesRequired && " *"}</FormLabel>
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

      {mode === "carrier" && (
        <FormSectionCard
          bare
          title="Основная отгрузка через ТК"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Загрузите фото или PDF накладной — поля заполнятся сами</span>
            <RecognizeWaybillButton
              disabled={disabled}
              onRecognized={(d) => {
                const opts = { shouldDirty: true, shouldValidate: true };
                if (d.transport_company) form.setValue("transport_company", d.transport_company, opts);
                if (d.waybill_number) form.setValue("waybill_number", d.waybill_number, opts);
                if (d.shipment_date) form.setValue("shipment_date", d.shipment_date, opts);
                if (d.delivery_date) form.setValue("delivery_date", d.delivery_date, opts);
              }}
            />
          </div>
          <div className="request-logistics-fields grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
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
        </FormSectionCard>
      )}
      <FormSectionCard
          bare
          title="Отдельные отгрузки"
          icon={<Boxes className="h-4 w-4 text-muted-foreground" />}
        >
          {requestId && organizationId ? (
            <RequestShipmentsPanel
              requestId={requestId}
              organizationId={organizationId}
              canEdit={!disabled}
              mode={mode}
              transportCompanies={recentTransportCompanies}
            />
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Сохраните заявку, чтобы добавить отдельные отгрузки с ТК, ТТН и датами.
              </div>
            </div>
          )}
        </FormSectionCard>
    </div>
    </FormSectionCard>
  );
};
