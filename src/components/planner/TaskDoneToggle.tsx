import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  status: string;
  className?: string;
  /** "circle" — компактный кружок, "button" — кнопка с подписью «Выполнить» */
  variant?: "circle" | "button";
}


/**
 * Shared "mark as done" toggle used by planner rows and the request task list.
 * Optimistic, no confirmation, toast with a 5s undo.
 */
export function TaskDoneToggle({ taskId, status, className }: Props) {
  const queryClient = useQueryClient();
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const prevStatusRef = useRef<string>(status !== "done" ? status : "todo");
  const current = localStatus ?? status;
  const done = current === "done";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["planner-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["planner-tasks-archived"] });
    queryClient.invalidateQueries({ queryKey: ["request-linked-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["request-task-counts"] });
    queryClient.invalidateQueries({ queryKey: ["planner-requests-without-tasks"] });
  };

  const setStatus = async (next: string) => {
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
      toast.error("Не удалось изменить статус", { description: error.message });
      return;
    }
    invalidate();
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const prev = current;
    let next: string;
    if (done) {
      next = prevStatusRef.current || "todo";
    } else {
      prevStatusRef.current = prev;
      next = "done";
    }
    await setStatus(next);
    toast(next === "done" ? "Задача выполнена" : "Задача возвращена в работу", {
      duration: 5000,
      action: {
        label: "Отменить",
        onClick: () => {
          void setStatus(prev);
        },
      },
    });
  };

  return (
    <button
      type="button"
      title="Отметить выполненной"
      aria-label="Отметить выполненной"
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
    </button>
  );
}
