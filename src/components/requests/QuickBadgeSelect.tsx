import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { STATUSES, PRIORITIES, getStatusColor, getPriorityColor } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";

interface QuickBadgeSelectProps {
  requestId: string;
  field: "status" | "priority";
  value: string;
  badge: React.ReactNode;
}

/** Single-click badge dropdown for fast status/priority change straight from the table. */
export const QuickBadgeSelect = ({ requestId, field, value, badge }: QuickBadgeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const options = field === "status" ? STATUSES : PRIORITIES;

  const handleSelect = async (val: string) => {
    setOpen(false);
    if (val === value) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ [field]: val })
        .eq("id", requestId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: field === "status" ? "Статус изменён" : "Приоритет изменён",
        description: val,
      });
    } catch (e) {
      console.error("QuickBadgeSelect save:", e);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменение",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {badge}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-[180px] p-1 z-[120]"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((opt) => {
          const color = field === "status" ? getStatusColor(opt) : getPriorityColor(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                opt === value && "bg-muted/70 font-medium"
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              {opt}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
