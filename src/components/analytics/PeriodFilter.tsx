import { Button } from "@/components/ui/button";
import { Calendar as CalIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, startOfQuarter, startOfYear, subDays, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";

export type Period = { from: Date; to: Date; label: string };

export function presetPeriods(): Period[] {
  const now = endOfDay(new Date());
  return [
    { label: "30 дней", from: subDays(now, 29), to: now },
    { label: "Месяц", from: startOfMonth(now), to: now },
    { label: "Квартал", from: startOfQuarter(now), to: now },
    { label: "Год", from: startOfYear(now), to: now },
  ];
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const presets = presetPeriods();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const active = p.label === value.label;
        return (
          <Button
            key={p.label}
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(p)}
          >
            {p.label}
          </Button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <CalIcon className="h-3.5 w-3.5" />
            {format(value.from, "dd.MM.yyyy", { locale: ru })} —{" "}
            {format(value.to, "dd.MM.yyyy", { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={{ from: value.from, to: value.to }}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onChange({ from: r.from, to: endOfDay(r.to), label: "Период" });
              }
            }}
            numberOfMonths={2}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
