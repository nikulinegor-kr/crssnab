import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { STATUSES, PRIORITIES, getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";

interface QuickBadgeSelectProps {
  requestId: string;
  field: "status" | "priority";
  value: string;
  badge: React.ReactNode;
  /** Внешнее управление меню (горячие клавиши S / P). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Триггер без обёртки-бейджа (например, полоса приоритета). */
  trigger?: React.ReactNode;
}

/** Явный элемент управления: клик по ячейке открывает меню статуса/приоритета. */
export const QuickBadgeSelect = ({
  requestId,
  field,
  value,
  badge,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: QuickBadgeSelectProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const options = field === "status" ? STATUSES : PRIORITIES;
  const label = field === "status" ? "Статус" : "Приоритет";

  /** Оптимистично меняем значение во всех кэшах списка заявок. */
  const patchCache = (next: string) => {
    queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((r: any) => (r?.id === requestId ? { ...r, [field]: next } : r));
    });
  };

  const persist = async (next: string, previous: string, withUndo: boolean) => {
    setIsSaving(true);
    patchCache(next);
    try {
      const { error } = await supabase.from("requests").update({ [field]: next }).eq("id", requestId);
      if (error) throw error;
      if (withUndo) {
        toast({
          title: field === "status" ? "Статус изменён" : "Приоритет изменён",
          description: next,
          duration: 5000,
          action: (
            <ToastAction altText="Отменить" onClick={() => persist(previous, next, false)}>
              Отменить
            </ToastAction>
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    } catch (e) {
      console.error("QuickBadgeSelect save:", e);
      patchCache(previous);
      toast({
        title: "Не удалось сохранить",
        description: `${label} остался прежним`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (next: string) => {
    setOpen(false);
    if (next === value) return;
    void persist(next, value, true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${value}`}
          className={cn("inline-flex items-center gap-1", !trigger && "group/qs cursor-pointer")}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {trigger ?? (
            <>
              {badge}
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-hover/qs:opacity-100" />
            </>
          )}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-1 z-[120]"
        align="start"
        data-row-action
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((opt) => {
          const color = field === "status" ? getStatusColor(opt) : getPriorityColor(opt);
          return (
            <button
              key={opt}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(opt);
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                opt === value && "bg-muted/70 font-medium"
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate">{opt}</span>
              {opt === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          );
        })}

      </PopoverContent>
    </Popover>
  );
};
