import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
}
export function TaskLookupSelect({ label, value, options, onChange, disabled }: Props) {
  return <Popover><PopoverTrigger asChild><Button disabled={disabled} variant="outline" role="combobox" aria-label={label} className="w-full min-w-0 justify-between font-normal">
    <span className="truncate">{options.find(o => o.id === value)?.name ?? (value ? "—" : label)}</span><ChevronsUpDown className="shrink-0 opacity-50" />
  </Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] min-w-60 p-0"><Command filter={(text, search) => search.toLowerCase().split(/\s+/).filter(Boolean).every(term => text.toLowerCase().includes(term)) ? 1 : 0}>
    <CommandInput placeholder={label} /><CommandList><CommandEmpty>Не найдено</CommandEmpty><CommandGroup>
      <CommandItem onSelect={() => onChange(null)}>—</CommandItem>
      {options.map(o => <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => onChange(o.id)}><Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />{o.name}</CommandItem>)}
    </CommandGroup></CommandList></Command></PopoverContent></Popover>;
}