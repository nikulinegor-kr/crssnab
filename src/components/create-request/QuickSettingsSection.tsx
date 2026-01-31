import { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
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
import { ParticipantSelect } from "@/components/ParticipantSelect";
import { ObjectSelectWithAdd } from "@/components/ObjectSelectWithAdd";
import { FormSectionCard } from "./FormSectionCard";
import { Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickSettingsSectionProps {
  form: UseFormReturn<any>;
  statuses: string[];
  priorities: string[];
  applicants: Array<{ id: string; name: string }>;
  executors: Array<{ id: string; name: string }>;
  objectsData: Array<{ id: string; name: string }> | undefined;
  currentOrgId: string | null;
}

export const QuickSettingsSection = ({
  form,
  statuses,
  priorities,
  applicants,
  executors,
  objectsData,
  currentOrgId,
}: QuickSettingsSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return (
    <FormSectionCard 
      title="Быстрые настройки" 
      icon={<Settings2 className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-4">
        {/* Status & Priority & Date row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="request_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Дата заявки *</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    className="h-9 min-w-0" 
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Статус *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите статус" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Приоритет *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите приоритет" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Participants row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="applicant"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Заявитель *</FormLabel>
                <FormControl>
                  <ParticipantSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={applicants.map(a => ({ value: a.id, label: a.name }))}
                    placeholder="Выбрать заявителя"
                    searchTitle="Поиск заявителя"
                    searchDescription="Найдите заявителя из списка"
                    addTitle="Добавить заявителя"
                    addDescription="Создайте нового заявителя"
                    editTitle="Редактировать заявителя"
                    editDescription="Измените имя заявителя"
                    deleteTitle="Удалить заявителя?"
                    entityName="заявителя"
                    onAddNew={async (name) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .insert({
                          name,
                          organization_id: currentOrgId || "",
                          participant_type: "applicant",
                        });
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Заявитель добавлен" });
                    }}
                    onDelete={async (id) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .delete()
                        .eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Заявитель удалён" });
                    }}
                    onEdit={async (id, newName) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .update({ name: newName })
                        .eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Заявитель обновлён" });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="executor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Исполнитель</FormLabel>
                <FormControl>
                  <ParticipantSelect
                    value={field.value || ""}
                    onChange={field.onChange}
                    options={executors.map(e => ({ value: e.id, label: e.name }))}
                    placeholder="Выбрать исполнителя"
                    searchTitle="Поиск исполнителя"
                    searchDescription="Найдите исполнителя из списка"
                    addTitle="Добавить исполнителя"
                    addDescription="Создайте нового исполнителя"
                    editTitle="Редактировать исполнителя"
                    editDescription="Измените имя исполнителя"
                    deleteTitle="Удалить исполнителя?"
                    entityName="исполнителя"
                    onAddNew={async (name) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .insert({
                          name,
                          organization_id: currentOrgId || "",
                          participant_type: "executor",
                        });
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Исполнитель добавлен" });
                    }}
                    onDelete={async (id) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .delete()
                        .eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Исполнитель удалён" });
                    }}
                    onEdit={async (id, newName) => {
                      const { error } = await supabase
                        .from("request_participants")
                        .update({ name: newName })
                        .eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Исполнитель обновлён" });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Object */}
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
