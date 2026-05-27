import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, ListChecks, CalendarClock, User } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import {
  usePlannerTasks,
  PRIORITY_META,
  PLANNER_COLUMNS,
  type PlannerTask,
  type PlannerTaskStatus,
} from "@/hooks/usePlannerTasks";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function PlannerTasksList() {
  const { data: tasks = [], isLoading } = usePlannerTasks();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlannerTaskStatus | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerTask | null>(null);
  const { data: members = [] } = useOrgMembers();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (onlyMine && t.assignee_id !== me) return false;
      if (terms.length === 0) return true;
      const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
  }, [tasks, search, statusFilter, onlyMine, me]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: PlannerTask) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск задач…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            Все
          </FilterChip>
          {PLANNER_COLUMNS.map((c) => (
            <FilterChip key={c.id} active={statusFilter === c.id} onClick={() => setStatusFilter(c.id)}>
              {c.title}
            </FilterChip>
          ))}
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Задача
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          Задач пока нет
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          {filtered.map((t, idx) => {
            const pr = PRIORITY_META[t.priority];
            const due = t.due_date ? new Date(t.due_date) : null;
            const overdue = due && isPast(due) && t.status !== "done";
            const checklistDone = t.checklist.filter((i) => i.done).length;
            return (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-accent/40 transition",
                  idx !== filtered.length - 1 && "border-b border-border/40"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", pr.dot)} />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium truncate", t.status === "done" && "line-through text-muted-foreground")}>
                    {t.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{PLANNER_COLUMNS.find((c) => c.id === t.status)?.title}</span>
                    {t.checklist.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" />
                        {checklistDone}/{t.checklist.length}
                      </span>
                    )}
                  </div>
                </div>
                {due && (
                  <Badge
                    variant="outline"
                    className={cn("font-numeric text-[10px]", overdue && "border-destructive text-destructive")}
                  >
                    <CalendarClock className="h-3 w-3 mr-1" />
                    {format(due, "d MMM", { locale: ru })}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      <PlannerTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs rounded-full border transition whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
