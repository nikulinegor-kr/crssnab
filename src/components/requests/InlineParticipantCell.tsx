import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { HighlightText } from "@/components/HighlightText";
import { useRequestParticipants } from "@/hooks/useRequestParticipants";
import { useRequestQuickUpdate } from "./useRequestQuickUpdate";
import { formatPersonName } from "@/lib/personName";

interface Props {
  requestId: string;
  organizationId: string | null;
  /** applicant — справочник заявителей, executor — справочник исполнителей. */
  field: "applicant" | "executor";
  value: string | null;
  searchQuery?: string;
}

/** Инлайн-выбор человека из своего справочника прямо в ячейке таблицы. */
export const InlineParticipantCell = ({ requestId, organizationId, field, value, searchQuery }: Props) => {
  const [open, setOpen] = useState(false);
  const { update, saving } = useRequestQuickUpdate();
  const { data: people = [] } = useRequestParticipants(field, organizationId, open);
  const shown = formatPersonName(value);

  const select = async (name: string | null) => {
    setOpen(false);
    await update(requestId, field, name, value ?? null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full text-left cursor-pointer hover:bg-muted/50 rounded p-0 m-0 transition-colors flex items-center justify-start gap-1"
          )}
          title={field === "applicant" ? "Выбрать заявителя" : "Выбрать исполнителя"}
        >
          {shown ? (
            <span className="line-clamp-2 leading-snug text-foreground">
              <HighlightText text={shown} searchQuery={searchQuery || ""} />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[240px] p-0 z-[120]"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder={field === "applicant" ? "Поиск заявителя..." : "Поиск исполнителя..."} />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => select(null)}>
                  <span className="text-muted-foreground italic">Снять назначение</span>
                </CommandItem>
              )}
              {people.map((person) => (
                <CommandItem key={person.id} value={person.name} onSelect={() => select(person.name)}>
                  <Check className={cn("mr-2 h-4 w-4", value === person.name ? "opacity-100" : "opacity-0")} />
                  {person.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
