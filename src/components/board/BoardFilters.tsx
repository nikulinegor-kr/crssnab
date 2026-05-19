import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BoardFilterKey =
  | "all"
  | "mine"
  | "urgent"
  | "overdue"
  | "no_response"
  | "no_supplier";

const FILTERS: { key: BoardFilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "mine", label: "Мои" },
  { key: "urgent", label: "Срочные" },
  { key: "overdue", label: "Просроченные" },
  { key: "no_response", label: "Без ответа" },
  { key: "no_supplier", label: "Без поставщика" },
];

interface Props {
  active: BoardFilterKey;
  onChange: (k: BoardFilterKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function BoardFilters({ active, onChange, search, onSearchChange }: Props) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={active === f.key ? "default" : "ghost"}
              className={cn(
                "h-8 shrink-0 text-xs",
                active === f.key ? "" : "text-muted-foreground"
              )}
              onClick={() => onChange(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по описанию, контрагенту…"
            className="h-8 pl-8"
          />
        </div>
      </div>
    </div>
  );
}
