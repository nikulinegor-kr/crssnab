import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ObjectSelectWithAdd } from "@/components/ObjectSelectWithAdd";
import { FormSectionCard } from "./FormSectionCard";
import { CalendarDays } from "lucide-react";

interface CoreParamsSectionProps {
  form: UseFormReturn<any>;
  objectsData: Array<{ id: string; name: string }> | undefined;
  currentOrgId: string | null;
}

export const CoreParamsSection = ({
  form,
  objectsData,
  currentOrgId,
}: CoreParamsSectionProps) => {
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormSectionCard>
  );
};
