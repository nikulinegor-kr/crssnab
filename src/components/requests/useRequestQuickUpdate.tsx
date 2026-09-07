import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export type QuickField = "status" | "priority" | "applicant" | "executor";

const FIELD_TITLES: Record<QuickField, string> = {
  status: "Статус изменён",
  priority: "Приоритет изменён",
  applicant: "Заявитель изменён",
  executor: "Исполнитель изменён",
};

/**
 * Оптимистичное изменение поля заявки из таблицы: строка и открытая панель
 * обновляются сразу, тост даёт 5 секунд на отмену, ошибка возвращает прежнее значение.
 */
export const useRequestQuickUpdate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const patchCache = useCallback(
    (requestId: string, field: QuickField, value: string | null) => {
      queryClient.setQueriesData({ queryKey: ["requests"] }, (old: any) =>
        Array.isArray(old) ? old.map((r: any) => (r?.id === requestId ? { ...r, [field]: value } : r)) : old
      );
    },
    [queryClient]
  );

  const update = useCallback(
    async (requestId: string, field: QuickField, next: string | null, previous: string | null, withUndo = true) => {
      if (next === previous) return;
      setSaving(true);
      patchCache(requestId, field, next);
      try {
        const { error } = await supabase.from("requests").update({ [field]: next }).eq("id", requestId);
        if (error) throw error;
        if (withUndo) {
          toast({
            title: FIELD_TITLES[field],
            description: next || "Значение снято",
            duration: 5000,
            action: (
              <ToastAction altText="Отменить" onClick={() => void update(requestId, field, previous, next, false)}>
                Отменить
              </ToastAction>
            ),
          });
        }
        queryClient.invalidateQueries({ queryKey: ["requests"] });
      } catch (e) {
        console.error("quick update:", e);
        patchCache(requestId, field, previous);
        toast({ title: "Не удалось сохранить", description: "Значение осталось прежним", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [patchCache, queryClient, toast]
  );

  return { update, saving };
};
