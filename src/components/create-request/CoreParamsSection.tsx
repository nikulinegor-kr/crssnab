import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ObjectSelectWithAdd } from "@/components/ObjectSelectWithAdd";
import { EquipmentSelectWithAdd } from "@/components/EquipmentSelectWithAdd";
import { FormSectionCard } from "./FormSectionCard";
import { CalendarDays, Wrench } from "lucide-react";

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
  const objectId = form.watch("object_id");
  const currentEquipmentId = form.watch("equipment_id");
  const [repairPurpose, setRepairPurpose] = useState<string>(
    currentEquipmentId ? "equipment" : "general"
  );

  // Determine if selected object is the repair object
  const selectedObject = objectsData?.find((o) => o.id === objectId);
  const isRepairObject = selectedObject?.name?.toLowerCase().includes("ремонт") ?? false;

  // Clear equipment when switching away from repair object or changing purpose
  useEffect(() => {
    if (!isRepairObject || repairPurpose !== "equipment") {
      form.setValue("equipment_id", "");
    }
  }, [isRepairObject, repairPurpose]);

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

      {isRepairObject && (
        <div className="mt-3 space-y-3">
          <FormSectionCard
            title="Назначение ремонта"
            icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
          >
            <RadioGroup
              value={repairPurpose}
              onValueChange={setRepairPurpose}
              className="flex flex-col gap-2"
              disabled={disabled}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="general" id="repair-general" />
                <Label htmlFor="repair-general" className="text-sm font-normal cursor-pointer">
                  Общие нужды
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="equipment" id="repair-equipment" />
                <Label htmlFor="repair-equipment" className="text-sm font-normal cursor-pointer">
                  Относимость к технике
                </Label>
              </div>
            </RadioGroup>

            {repairPurpose === "equipment" && (
              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="equipment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Техника</FormLabel>
                      <FormControl>
                        <EquipmentSelectWithAdd
                          value={field.value || ""}
                          onChange={field.onChange}
                          organizationId={currentOrgId}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </FormSectionCard>
        </div>
      )}
    </FormSectionCard>
  );
};
