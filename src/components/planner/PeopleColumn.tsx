import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/hooks/useOrgMembers";
import type { PlannerTask } from "@/hooks/usePlannerTasks";
import { KanbanCard } from "./KanbanColumn";

export interface PeopleColumnMetrics {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
}

export function peopleMetrics(tasks: PlannerTask[]): PeopleColumnMetrics {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
  const active = tasks.filter((t) => t.status !== "done");
  let overdue = 0;
  let today = 0;
  let upcoming = 0;
  for (const t of active) {
    if (!t.due_date) continue;
    const d = new Date(t.due_date).getTime();
    if (d < startOfToday) overdue++;
    else if (d <= endOfToday) today++;
    else upcoming++;
  }
  return { total: active.length, overdue, today, upcoming };
}

export function PeopleColumn({
  id,
  name,
  role,
  tasks,
  onCardClick,
  onAddClick,
  children,
}: {
  id: string;
  name: string;
  role?: string | null;
  tasks: PlannerTask[];
  onCardClick: (t: PlannerTask) => void;
  onAddClick?: () => void;
  /** Extra cards rendered above tasks (used by the "Не распределено" column). */
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "people-column", columnId: id } });
  const m = peopleMetrics(tasks);
  const share = m.total > 0 ? m.overdue / m.total : 0;
  const alarming = share > 1 / 3;

  return (
    <div
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-xl bg-muted/40 border transition-colors",
        alarming ? "border-destructive/40" : "border-border/50"
      )}
    >
      <div className="px-3 py-2.5 border-b border-border/40 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">{initialsOf({ full_name: name })}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            {role && <div className="text-[11px] text-muted-foreground truncate">{role}</div>}
          </div>
          <Badge
            variant="secondary"
            className={cn("h-5 px-1.5 text-[11px] font-numeric", alarming && "bg-destructive/10 text-destructive")}
          >
            {m.total}
          </Badge>
          {onAddClick && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAddClick}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", alarming ? "bg-destructive" : "bg-primary")}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-3 text-[11px] font-numeric">
          <span className={cn(alarming ? "text-destructive font-semibold" : "text-muted-foreground")}>
            {m.overdue} просроч.
          </span>
          <span className="text-muted-foreground">{m.today} сегодня</span>
          <span className="text-muted-foreground">{m.upcoming} далее</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn("flex-1 p-2 space-y-2 min-h-[140px] overflow-y-auto transition-colors", isOver && "bg-primary/5")}
      >
        {children}
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !children && (
          <p className="text-[11px] text-muted-foreground px-1 py-4 text-center">Нет задач</p>
        )}
      </div>
    </div>
  );
}
