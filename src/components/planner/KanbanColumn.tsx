import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarClock, GripVertical, ListChecks, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PRIORITY_META, type PlannerTask, type PlannerTaskStatus } from "@/hooks/usePlannerTasks";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { PlannerTaskMeta } from "./PlannerTaskMeta";

export function KanbanCard({
  task,
  onClick,
}: {
  task: PlannerTask;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const pr = PRIORITY_META[task.priority];
  const checklistDone = task.checklist.filter((i) => i.done).length;
  const checklistTotal = task.checklist.length;
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = dueDate && isPast(dueDate) && task.status !== "done";
  const dueToday = dueDate && isToday(dueDate);
  const { data: members = [] } = useOrgMembers();
  const assignee = task.assignee_id ? members.find((m) => m.user_id === task.assignee_id) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer p-3 space-y-2"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
        <div className="flex-1 text-sm font-medium leading-snug line-clamp-3">{task.title}</div>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
          aria-label="Перетащить"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <PlannerTaskMeta equipmentId={task.equipment_id} objectId={task.object_id} />

      {(checklistTotal > 0 || dueDate || task.priority !== "medium" || assignee) && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          {task.priority !== "medium" && (
            <span className={cn("rounded px-1.5 py-0.5 font-medium", pr.className)}>{pr.label}</span>
          )}
          {checklistTotal > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "text-destructive font-medium",
                dueToday && !overdue && "text-orange-500 font-medium"
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {format(dueDate, "d MMM", { locale: ru })}
            </span>
          )}
          {assignee && (
            <Avatar className="h-5 w-5 ml-auto" title={assignee.full_name || assignee.email || ""}>
              <AvatarFallback className="text-[9px]">{initialsOf(assignee)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
    </div>
  );
}

export function KanbanColumn({
  column,
  tasks,
  onAddClick,
  onCardClick,
}: {
  column: { id: PlannerTaskStatus; title: string };
  tasks: PlannerTask[];
  onAddClick: () => void;
  onCardClick: (t: PlannerTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", status: column.id } });

  return (
    <div className="flex flex-col w-[280px] shrink-0 rounded-xl bg-muted/40 border border-border/50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.title}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-numeric">{tasks.length}</Badge>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAddClick}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 min-h-[120px] transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button
            onClick={onAddClick}
            className="w-full rounded-md border border-dashed border-border/60 py-6 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
          >
            + Добавить задачу
          </button>
        )}
      </div>
    </div>
  );
}
