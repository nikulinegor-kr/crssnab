import type { SpecialDateFilter } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";

const ITEMS: Array<{ label: string; filter: Exclude<SpecialDateFilter, null> }> = [
  { label: "Просрочено", filter: "overdue" },
  { label: "Ждёт оплаты", filter: "unpaid" },
  { label: "Без движения", filter: "stale" },
];

export const MobileAttentionChips = ({ active, onChange }: { active: SpecialDateFilter; onChange: (f: SpecialDateFilter) => void }) => (
  <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Требует внимания">
    {ITEMS.map((item) => {
      const on = active === item.filter;
      return (
        <button key={item.filter} type="button" aria-pressed={on} onClick={() => onChange(on ? null : item.filter)}
          className={cn("min-h-10 min-w-0 rounded-lg border px-1 text-[12px] font-medium leading-tight",
            on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-foreground")}>
          {item.label}
        </button>
      );
    })}
  </div>
);
