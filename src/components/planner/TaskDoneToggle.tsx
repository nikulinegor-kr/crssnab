import { useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { invalidatePlannerTaskQueries, type PlannerTask } from "@/hooks/usePlannerTasks";
import { useTaskHubIdentity } from "@/hooks/useTaskHubIdentity";
import { canReviewTask } from "@/lib/taskHub";

interface Props {
  task: PlannerTask;
  className?: string;
  /** "circle" — компактный кружок, "button" — кнопка с подписью «Выполнить» */
  variant?: "circle" | "button";
}


/**
 * Shared "mark as done" toggle used by planner rows and the request task list.
 * Optimistic, no confirmation, toast with a 5s undo.
 */
export function TaskDoneToggle({ task, className, variant = "circle" }: Props) {
  const { id: taskId, status } = task;
  const { userId, isAdmin } = useTaskHubIdentity();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const prevStatusRef = useRef<string>(status !== "done" ? status : "todo");
  const current = localStatus ?? status;
  const done = current === "done";
  const sendToReview = task.requires_acceptance && !canReviewTask(task, userId, isAdmin);
  useEffect(() => { setLocalStatus(null); }, [status]);

  const invalidate = () => {
    invalidatePlannerTaskQueries(queryClient);
  };

  const setStatus = async (next: string) => {
    setPending(true);
    setLocalStatus(next);
    const { error } = await supabase
      .from("planner_tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
    if (error) {
      setLocalStatus(null);
      setPending(false);
      toast.error("Не удалось изменить статус", { description: error.message });
      return false;
    }
    invalidate();
    setPending(false);
    return true;
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (pending || !userId) return;
    const prev = current;
    let next: string;
    if (done) {
      next = prevStatusRef.current || "todo";
    } else {
      prevStatusRef.current = prev;
      next = sendToReview ? "review" : "done";
    }
    if (!await setStatus(next)) return;
    toast(next === "review" ? "Передано на проверку" : next === "done" ? "Задача выполнена" : "Задача возвращена в работу", {
      duration: 5000,
      action: {
        label: "Отменить",
        onClick: () => {
          void setStatus(prev);
        },
      },
    });
  };

  if (variant === "button") {
    return (
      <Button variant="outline"
        type="button"
        disabled={pending || !userId}
        title={done ? "Вернуть в работу" : sendToReview ? "Передать на проверку" : "Отметить выполненной"}
        aria-pressed={done}
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "shrink-0 inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
          done
            ? "border-success/40 bg-success/10 text-success"
            : "border-border hover:border-success hover:bg-success/10 hover:text-success",
          className
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {done ? "Выполнено" : sendToReview ? "На проверку" : "Выполнить"}
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon"
      type="button"
      disabled={pending || !userId}
      title={done ? "Вернуть в работу" : sendToReview ? "Передать на проверку" : "Отметить выполненной"}
      aria-label={done ? "Вернуть в работу" : sendToReview ? "Передать на проверку" : "Отметить выполненной"}
      aria-pressed={done}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md",
        "hover:bg-success/10 transition-colors",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center h-5 w-5 rounded-full border-2 transition-colors",
          done
            ? "bg-success border-success text-background"
            : "border-muted-foreground/50 text-transparent group-hover:border-success group-hover:text-success hover:border-success hover:text-success"
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </Button>
  );
}
