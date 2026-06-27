import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ClipboardList, Plus, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import type { PlannerTask } from "@/hooks/usePlannerTasks";

const PRIORITY_DOT: Record<string, string> = {
  critical: "🔴",
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Новая",
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнено",
};

interface Props {
  requestId: string;
  organizationId: string;
}

export function LinkedPlannerTasks({ requestId, organizationId }: Props) {
  const [open, setOpen] = useState(false);
  const [editTask, setEditTask] = useState<PlannerTask | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["request-linked-tasks", requestId],
    queryFn: async () => {
      const { data } = await supabase
        .from("planner_tasks")
        .select("*")
        .eq("request_id", requestId)
        .or("source.is.null,source.eq.manual")
        .order("due_date", { ascending: true, nullsFirst: false });
      return ((data ?? []) as unknown) as PlannerTask[];
    },
    enabled: !!requestId,
  });

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Личные задачи по заявке
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {tasks.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => {
            setEditTask(null);
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </Button>
      </CardHeader>
      <CardContent className="pt-1 space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Нет связанных личных задач
          </p>
        )}
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setEditTask(t);
              setOpen(true);
            }}
            className="w-full text-left flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 hover:bg-muted/40 transition-colors"
          >
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                t.status === "done"
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            />
            <span className="text-base shrink-0">
              {PRIORITY_DOT[t.priority] ?? "🟡"}
            </span>
            <span
              className={`flex-1 text-sm truncate ${
                t.status === "done" ? "line-through text-muted-foreground" : ""
              }`}
            >
              {t.title}
            </span>
            {t.due_date && (
              <span className="text-xs text-muted-foreground shrink-0">
                {format(parseISO(t.due_date), "d MMM", { locale: ru })}
              </span>
            )}
            <Badge variant="outline" className="text-[10px] shrink-0">
              {STATUS_LABEL[t.status] ?? t.status}
            </Badge>
          </button>
        ))}
      </CardContent>

      <PlannerTaskDialog
        open={open}
        onOpenChange={setOpen}
        task={editTask}
        defaultRequestId={requestId}
      />
    </Card>
  );
}
