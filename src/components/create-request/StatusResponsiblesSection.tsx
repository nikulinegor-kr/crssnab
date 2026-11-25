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
import { ParticipantSelect } from "@/components/ParticipantSelect";
import { FormSectionCard } from "./FormSectionCard";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StatusResponsiblesSectionProps {
  form: UseFormReturn<any>;
  statuses: string[];
  priorities: string[];
  applicants: Array<{ id: string; name: string; telegram_username?: string | null }>;
  executors: Array<{ id: string; name: string }>;
  currentOrgId: string | null;
  disabled?: boolean;
  onStatusChange?: (status: string) => boolean;
}

export const StatusResponsiblesSection = ({
  form,
  statuses,
  priorities,
  applicants,
  executors,
  currentOrgId,
  disabled = false,
  onStatusChange,
}: StatusResponsiblesSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return (
    <FormSectionCard
      bare
      title="Статус и ответственные"
      icon={<Users className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="req-flat space-y-3 sm:space-y-4">
        {/* Status & Priority */}
        <div className="req-flat request-mobile-stack grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="req-a-status">
                <FormLabel className="text-xs">Статус *</FormLabel>
                <Select value={field.value || ""} onValueChange={status => { if (onStatusChange?.(status) !== false) field.onChange(status); }} disabled={disabled}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите статус">{field.value || undefined}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
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
              <FormItem className="req-a-priority min-w-0 w-full max-w-full">
                <FormLabel className="text-xs">Приоритет *</FormLabel>
                <Select value={field.value || ""} onValueChange={field.onChange} disabled={disabled}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Выберите приоритет">{field.value || undefined}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Applicant & Executor */}
        <div className="req-flat grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <FormField
            control={form.control}
            name="applicant"
            render={({ field }) => (
              <FormItem className="req-a-applicant">
                <FormLabel className="text-xs">Заявитель *</FormLabel>
                <FormControl>
                  <ParticipantSelect
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                    options={applicants.map((a) => ({ value: a.id, label: a.name }))}
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
                      const { error } = await supabase.from("request_participants").insert({
                        name, organization_id: currentOrgId || "", participant_type: "applicant",
                      });
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Заявитель добавлен" });
                    }}
                    onDelete={async (id) => {
                      const { error } = await supabase.from("request_participants").delete().eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Заявитель удалён" });
                    }}
                    onEdit={async (id, newName) => {
                      const { error } = await supabase.from("request_participants").update({ name: newName }).eq("id", id);
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
              <FormItem className="req-a-executor">
                <FormLabel className="text-xs">Исполнитель *</FormLabel>
                <FormControl>
                  <ParticipantSelect
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    options={executors.map((e) => ({ value: e.id, label: e.name }))}
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
                      const { error } = await supabase.from("request_participants").insert({
                        name, organization_id: currentOrgId || "", participant_type: "executor",
                      });
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Исполнитель добавлен" });
                    }}
                    onDelete={async (id) => {
                      const { error } = await supabase.from("request_participants").delete().eq("id", id);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
                      toast({ title: "Успешно", description: "Исполнитель удалён" });
                    }}
                    onEdit={async (id, newName) => {
                      const { error } = await supabase.from("request_participants").update({ name: newName }).eq("id", id);
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

      </div>
    </FormSectionCard>
  );
};
