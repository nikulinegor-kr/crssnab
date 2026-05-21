import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { HighlightText } from "@/components/HighlightText";

interface Props {
  requestId: string;
  organizationId: string | null;
  value: string | null;
  searchQuery?: string;
}

export const InlineExecutorCell = ({ requestId, organizationId, value, searchQuery }: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: executors = [] } = useQuery({
    queryKey: ["request-participants", organizationId, "executor"],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_participants")
        .select("id, name")
        .eq("organization_id", organizationId!)
        .eq("participant_type", "executor")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const handleSelect = async (name: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ executor: name })
        .eq("id", requestId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Исполнитель обновлён", description: name || "Снято назначение" });
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full text-center cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors flex items-center justify-center gap-1",
          )}
          title="Нажмите, чтобы выбрать исполнителя"
        >
          {value ? (
            <span className="line-clamp-2 leading-snug text-foreground">
              <HighlightText text={value} searchQuery={searchQuery || ""} />
            </span>
          ) : (
            <span className="text-[#9CA3AF] text-[12px] italic">не назначен</span>
          )}
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[240px] p-0 z-[100]"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Поиск исполнителя..." />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => handleSelect(null)}>
                  <span className="text-muted-foreground italic">Снять назначение</span>
                </CommandItem>
              )}
              {executors.map((ex) => (
                <CommandItem
                  key={ex.id}
                  value={ex.name}
                  onSelect={() => handleSelect(ex.name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === ex.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {ex.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
