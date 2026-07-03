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
import { PlannerTaskMeta } from "@/components/planner/PlannerTaskMeta";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { supabase } from "@/integrations/supabase/client";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { usePlannerLookups } from "@/hooks/usePlannerEquipment";
import { cn } from "@/lib/utils";

export default function PlannerTasksList() {
  const { data: rawTasks = [], isLoading } = usePlannerTasks();
  const filters = usePlannerFilters();
  const { equipmentMap, objectMap } = usePlannerLookups();
  const tasks = useMemo(() => filters.apply(rawTasks), [rawTasks, filters]);
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
          <FilterChip active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
            <User className="h-3 w-3 inline mr-1" />Мои
          </FilterChip>
          <FilterChip active={statusFilter === "all" && !onlyMine} onClick={() => { setStatusFilter("all"); setOnlyMine(false); }}>
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
        (() => {
          const groups: { key: string; label: string; items: typeof filtered }[] = [];
          if (filters.groupBy === "none") {
            groups.push({ key: "all", label: "", items: filtered });
          } else {
            const buckets = new Map<string, typeof filtered>();
            for (const t of filtered) {
              let key = "—";
              let label = "Без привязки";
              if (filters.groupBy === "object") {
                const eq = t.equipment_id ? equipmentMap.get(t.equipment_id) : null;
                const oid = t.object_id || eq?.current_object_id || null;
                if (oid) { key = oid; label = objectMap.get(oid)?.name || "Объект"; }
              } else if (filters.groupBy === "equipment") {
                if (t.equipment_id) {
                  const eq = equipmentMap.get(t.equipment_id);
                  key = t.equipment_id;
                  label = eq ? `${eq.brand} ${eq.model}`.trim() : "Техника";
                }
              }
              const arr = buckets.get(key) ?? [];
              arr.push(t);
              buckets.set(key, arr);
              if (!groups.find((g) => g.key === key)) groups.push({ key, label, items: arr });
            }
          }
          return (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key} className="rounded-lg border border-border/60 overflow-hidden">
                  {group.label && (
                    <div className="px-3 py-1.5 text-xs font-semibold bg-muted/40 border-b border-border/40 flex items-center justify-between">
                      <span>{group.label}</span>
                      <span className="font-numeric text-muted-foreground">{group.items.length}</span>
                    </div>
                  )}
                  {group.items.map((t, idx) => {
                    const pr = PRIORITY_META[t.priority];
                    const due = t.due_date ? new Date(t.due_date) : null;
                    const overdue = due && isPast(due) && t.status !== "done";
                    const checklistDone = t.checklist.filter((i) => i.done).length;
                    const assignee = t.assignee_id ? members.find((m) => m.user_id === t.assignee_id) : null;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-accent/40 transition",
                          idx !== group.items.length - 1 && "border-b border-border/40"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", pr.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-medium truncate", t.status === "done" && "line-through text-muted-foreground")}>
                            {t.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            <span>{PLANNER_COLUMNS.find((c) => c.id === t.status)?.title}</span>
                            {t.checklist.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <ListChecks className="h-3 w-3" />
                                {checklistDone}/{t.checklist.length}
                              </span>
                            )}
                          </div>
                          <PlannerTaskMeta
                            equipmentId={t.equipment_id}
                            equipmentIds={t.equipment_ids}
                            objectId={t.object_id}
                            assigneeId={t.assignee_id}
                            className="mt-1"
                          />
                        </div>
                        {assignee && (
                          <Avatar className="h-6 w-6" title={assignee.full_name || assignee.email || ""}>
                            <AvatarFallback className="text-[10px]">{initialsOf(assignee)}</AvatarFallback>
                          </Avatar>
                        )}
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
              ))}
            </div>
          );
        })()
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
