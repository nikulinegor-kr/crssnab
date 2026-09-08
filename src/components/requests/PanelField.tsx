import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PanelFieldOption {
  value: string;
  label: string;
}

interface PanelFieldProps {
  label: string;
  /** Текущее «сырое» значение (то, что уходит в базу). */
  value: string | number | null | undefined;
  /** Как значение показывается, когда поле не редактируется. */
  display?: React.ReactNode;
  type: "text" | "number" | "date" | "select";
  options?: PanelFieldOption[];
  /** Возвращает промис — пока он идёт, в поле крутится тонкий индикатор. */
  onSave: (next: string) => Promise<void> | void;
  readOnly?: boolean;
  accent?: boolean;
  suffix?: string;
  /** Режим правки: поле всегда показано как редактор. */
  alwaysEdit?: boolean;
}

/** Поле карточки заявки: клик по значению превращает его в редактор нужного типа. */
export const PanelField = ({
  label,
  value,
  display,
  type,
  options,
  onSave,
  readOnly = false,
  accent,
  suffix,
  alwaysEdit = false,
}: PanelFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const forced = alwaysEdit && !readOnly;

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && type !== "select") inputRef.current?.focus();
  }, [editing, type]);


  const filtered = useMemo(() => {
    const list = options ?? [];
    if (!search.trim()) return list;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)));
  }, [options, search]);

  const commit = async (next: string) => {
    setEditing(false);
    if (next === String(value ?? "")) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  const shown = display ?? (value === null || value === undefined || value === "" ? null : String(value));

  const staticView = (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => !readOnly && setEditing(true)}
      title={readOnly ? "Нет прав на изменение" : shown ? "Клик — изменить" : "Добавить"}
      className={cn(
        "group/pf flex min-h-[2rem] w-full items-center gap-1 rounded px-1 -mx-1 text-left text-[0.9375rem] leading-5",
        readOnly ? "cursor-default" : "cursor-text hover:bg-[hsl(var(--surface-3))]",
        accent ? "text-primary" : "text-foreground"
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        {shown ?? (
          <span className="text-muted-foreground">
            <span className={cn(!readOnly && "group-hover/pf:hidden")}>—</span>
            {!readOnly && <span className="hidden group-hover/pf:inline">Добавить</span>}
          </span>
        )}
      </span>
      {saving && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      {!readOnly && !saving && (
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/pf:opacity-100" />
      )}
    </button>
  );


  let editor: React.ReactNode = null;

  if (editing && type === "select") {
    editor = (
      <Popover open onOpenChange={(o) => !o && setEditing(false)}>
        <PopoverTrigger asChild>
          <span className="block w-full text-[0.9375rem]">{shown ?? "—"}</span>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-1 z-[130]" align="start">
          <div className="flex items-center gap-1.5 border-b border-border px-1.5 pb-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск"
              className="h-6 w-full bg-transparent text-xs focus:outline-none"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto pt-1">
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
              onClick={() => commit("")}
            >
              — очистить
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted",
                  o.value === String(value ?? "") && "bg-muted/70 font-medium"
                )}
                onClick={() => commit(o.value)}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Ничего не найдено</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  } else if (editing) {
    editor = (
      <Input
        ref={inputRef}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(String(value ?? ""));
            setEditing(false);
          }
        }}

        className="h-8 px-1.5 text-[0.9375rem]"
      />
    );
  }

  return (
    <div className="flex min-h-[2rem] items-center gap-3 py-[2px]">
      <div className="w-[8.125rem] shrink-0 text-[0.8125rem] leading-5 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1">
        {editing ? editor : staticView}
      </div>
      {suffix && <span className="shrink-0 text-[0.8125rem] text-muted-foreground">{suffix}</span>}
    </div>
  );
};
