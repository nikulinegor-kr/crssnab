import { format, isPast, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarClock, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlannerTaskMeta } from "@/components/planner/PlannerTaskMeta";
import { PLANNER_COLUMNS, PRIORITY_META, type PlannerTask } from "@/hooks/usePlannerTasks";
import { initialsOf, type OrgMember } from "@/hooks/useOrgMembers";
import { cn } from "@/lib/utils";

interface Props {
  task: PlannerTask;
  members: OrgMember[];
  onClick: (task: PlannerTask) => void;
  className?: string;
  hideDate?: boolean;
}

/** Shared task card used by every planner view (today / week / all / mine / team). */
export function PlannerTaskRow({ task, members, onClick, className, hideDate }: Props) {
  const pr = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const due = task.due_date ? new Date(task.due_date) : null;
  const overdue = !!due && isPast(due) && !isToday(due) && task.status !== "done";
  const checklistDone = (task.checklist ?? []).filter((i) => i.done).length;
  const assignee = task.assignee_id ? members.find((m) => m.user_id === task.assignee_id) : null;

  return (
    <button
      onClick={() => onClick(task)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40 transition",
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", pr.dot)} />
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium truncate",
            task.status === "done" && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
          <span>{PLANNER_COLUMNS.find((c) => c.id === task.status)?.title}</span>
          {(task.checklist ?? []).length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {checklistDone}/{task.checklist.length}
            </span>
          )}
          {overdue && <span className="text-destructive font-medium">просрочено</span>}
        </div>
        <PlannerTaskMeta
          equipmentId={task.equipment_id}
          equipmentIds={task.equipment_ids}
          objectId={task.object_id}
          assigneeId={task.assignee_id}
          className="mt-1"
        />
      </div>
      {assignee && (
        <Avatar className="h-6 w-6" title={assignee.full_name || assignee.email || ""}>
          <AvatarFallback className="text-[10px]">{initialsOf(assignee)}</AvatarFallback>
        </Avatar>
      )}
      {due && !hideDate && (
        <Badge
          variant="outline"
          className={cn("font-numeric text-[10px] shrink-0", overdue && "border-destructive text-destructive")}
        >
          <CalendarClock className="h-3 w-3 mr-1" />
          {format(due, "d MMM", { locale: ru })}
        </Badge>
      )}
    </button>
  );
}
