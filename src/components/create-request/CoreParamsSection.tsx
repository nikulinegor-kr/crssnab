import { UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { ObjectSelectWithAdd } from "@/components/ObjectSelectWithAdd";
import { FormSectionCard } from "./FormSectionCard";
import { CalendarDays } from "lucide-react";

const REQUEST_TYPES = [
  "Закупка",
  "Ремонт и восстановление техники",
  "Хозяйственные нужды",
];

interface CoreParamsSectionProps {
  form: UseFormReturn<any>;
  objectsData: Array<{ id: string; name: string }> | undefined;
  currentOrgId: string | null;
  disabled?: boolean;
}

export const CoreParamsSection = ({
  form,
  objectsData,
  currentOrgId,
  disabled = false,
}: CoreParamsSectionProps) => {
  const requestType = form.watch("request_type");
  const showEquipment = requestType === "Ремонт и восстановление техники";

  const { data: equipmentList = [] } = useQuery({
    queryKey: ["equipment", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, year, vin")
        .eq("organization_id", currentOrgId!)
        .order("brand")
        .order("model");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && showEquipment,
  });

  const formatEquipment = (e: any) => {
    const parts = [
      [e.brand, e.model].filter(Boolean).join(" "),
      e.year,
      e.vin ? `VIN ${e.vin}` : null,
    ].filter(Boolean);
    return parts.join(" • ");
  };

  return (
    <FormSectionCard
      title="Основные параметры"
      icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <FormField
          control={form.control}
          name="request_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Дата заявки *</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className="h-9 min-w-0 text-sm"
                  title="Дата создания заявки"
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
          name="object_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Объект</FormLabel>
              <FormControl>
                <ObjectSelectWithAdd
                  value={field.value || ""}
                  onChange={field.onChange}
                  objects={objectsData}
                  organizationId={currentOrgId}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className={showEquipment ? "grid grid-cols-2 gap-2 sm:gap-3 mt-3" : "mt-3"}>
        <FormField
          control={form.control}
          name="request_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Тип заявки</FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  if (val !== "Ремонт и восстановление техники") {
                    form.setValue("equipment_id", "");
                  }
                }}
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showEquipment && (
          <FormField
            control={form.control}
            name="equipment_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Относимость к технике</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите технику" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {equipmentList.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatEquipment(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </FormSectionCard>
  );
};
