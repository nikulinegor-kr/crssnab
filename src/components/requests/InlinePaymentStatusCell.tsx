import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  requestId: string;
  paymentPercent: number;
}

const STATUS_OPTIONS = [
  {
    label: "Не оплачено",
    value: "not_paid" as const,
    targetPercent: 1,
    className: "text-red-600 bg-red-50 border-red-200",
    dotClass: "bg-red-500",
  },
  {
    label: "Частично оплачено",
    value: "partial" as const,
    targetPercent: 50,
    className: "text-blue-600 bg-blue-50 border-blue-200",
    dotClass: "bg-blue-500",
  },
  {
    label: "Оплачено",
    value: "paid" as const,
    targetPercent: 100,
    className: "text-emerald-600 bg-emerald-50 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
];

function resolveStatus(pct: number) {
  if (pct <= 1) return STATUS_OPTIONS[0];
  if (pct >= 100) return STATUS_OPTIONS[2];
  return STATUS_OPTIONS[1];
}

export const InlinePaymentStatusCell = ({ requestId, paymentPercent }: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentStatus = resolveStatus(paymentPercent);

  const handleSelect = async (option: (typeof STATUS_OPTIONS)[number]) => {
    setSaving(true);
    try {
      let newPercent = option.targetPercent;
      if (option.value === "partial") {
        if (paymentPercent > 1 && paymentPercent < 100) {
          newPercent = paymentPercent;
        } else {
          newPercent = 50;
        }
      }

      const paymentStatus =
        option.value === "not_paid"
          ? "Не оплачено"
          : option.value === "paid"
          ? "Оплачено"
          : "Частично оплачено";

      const { error } = await supabase
        .from("requests")
        .update({
          payment_percent: newPercent,
          payment_status: paymentStatus,
        })
        .eq("id", requestId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: "Статус оплаты обновлён",
        description: `${option.label} (${newPercent}%)`,
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить статус оплаты",
        variant: "destructive",
      });
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
          title="Нажмите, чтобы изменить статус оплаты"
        >
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              currentStatus.className,
            )}
          >
            {currentStatus.label}
            {currentStatus.value === "partial" && paymentPercent > 1 && paymentPercent < 100 && (
              <span className="ml-1 opacity-80">{paymentPercent}%</span>
            )}
          </span>
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-2 z-[100]"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={saving}
              className={cn(
                "w-full flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:opacity-90",
                option.className,
                currentStatus.value === option.value && "ring-1 ring-offset-1 ring-current",
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    option.dotClass,
                  )}
                />
                {option.label}
              </span>
              {currentStatus.value === option.value && (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
