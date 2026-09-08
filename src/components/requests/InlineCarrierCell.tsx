import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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

/** Выбор транспортной компании прямо в ячейке таблицы — список уже используемых ТК. */
export const InlineCarrierCell = ({ requestId, organizationId, value, searchQuery }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: carriers = [] } = useQuery({
    queryKey: ["carriers", organizationId],
    enabled: !!organizationId && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("requests")
        .select("transport_company")
        .eq("organization_id", organizationId!)
        .not("transport_company", "is", null)
        .neq("transport_company", "")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => String(r.transport_company).trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ru")
      );
    },
  });

  const patchCache = (next: string | null) => {
    queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
      Array.isArray(old) ? old.map((r: any) => (r?.id === requestId ? { ...r, transport_company: next } : r)) : old
    );
  };

  const select = async (next: string | null) => {
    setOpen(false);
    setQuery("");
    if ((next || null) === (value || null)) return;
    setSaving(true);
    patchCache(next);
    try {
      const { error } = await supabase.from("requests").update({ transport_company: next }).eq("id", requestId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "ТК изменена", description: next || "Значение снято" });
    } catch (e) {
      console.error("carrier update:", e);
      patchCache(value ?? null);
      toast({ title: "Не удалось сохранить", description: "Значение осталось прежним", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const trimmed = query.trim();
  const canCreate = trimmed.length > 0 && !carriers.some((c) => c.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-row-action
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-start gap-1 rounded p-0 text-left transition-colors hover:bg-muted/50"
          title="Выбрать транспортную компанию"
        >
          {value ? (
            <span className="line-clamp-2 leading-snug text-foreground">
              <HighlightText text={value} searchQuery={searchQuery || ""} />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {saving ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[120] w-[240px] p-0"
        align="start"
        data-row-action
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Поиск или новая ТК..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              {canCreate && (
                <CommandItem value={`__new__${trimmed}`} onSelect={() => select(trimmed)}>
                  <span className="truncate">Добавить «{trimmed}»</span>
                </CommandItem>
              )}
              {value && (
                <CommandItem value="__clear__" onSelect={() => select(null)}>
                  <span className="italic text-muted-foreground">Очистить</span>
                </CommandItem>
              )}
              {carriers.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => select(name)}>
                  <Check className={cn("mr-2 h-4 w-4", value === name ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
