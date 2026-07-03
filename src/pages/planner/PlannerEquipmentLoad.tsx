import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, User as UserIcon, Calendar } from "lucide-react";
import { format, isPast } from "date-fns";
import { ru } from "date-fns/locale";
import { usePlannerTasks, PRIORITY_META, PLANNER_COLUMNS, type PlannerTask } from "@/hooks/usePlannerTasks";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { cn } from "@/lib/utils";

export default function PlannerEquipmentLoad() {
  const { data: allTasks = [] } = usePlannerTasks();
  const filters = usePlannerFilters();
  const tasks = useMemo(() => filters.apply(allTasks), [allTasks, filters]);
  const { equipment, equipmentMap, objectMap } = usePlannerLookups();
  const { data: members = [] } = useOrgMembers();
  const [editing, setEditing] = useState<PlannerTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const byEquipment = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    for (const t of activeTasks) {
      const ids = t.equipment_ids?.length ? t.equipment_ids : (t.equipment_id ? [t.equipment_id] : []);
      for (const eid of ids) {
        const arr = map.get(eid) ?? [];
        arr.push(t);
        map.set(eid, arr);
      }
    }
    return map;
  }, [activeTasks]);

  const rows = useMemo(() => {
    return equipment
      .map((eq) => ({ eq, tasks: byEquipment.get(eq.id) ?? [] }))
      .filter((r) => r.tasks.length > 0)
      .sort((a, b) => b.tasks.length - a.tasks.length);
  }, [equipment, byEquipment]);

  const openEdit = (t: PlannerTask) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Где работает техника</h2>
        <p className="text-xs text-muted-foreground">Активные задачи по каждой единице техники</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          Нет активной техники в работе
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map(({ eq, tasks: eqTasks }) => {
            const obj = eq.current_object_id ? objectMap.get(eq.current_object_id) : null;
            return (
              <Card key={eq.id} className="p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{equipmentLabel(eq)}</div>
                      {eq.plate_number && (
                        <div className="text-[11px] text-muted-foreground font-numeric">Гос. № {eq.plate_number}</div>
                      )}
                    </div>
                    <Badge variant="secondary" className="font-numeric">{eqTasks.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {obj && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-500" /> {obj.name}
                      </span>
                    )}
                    {eq.responsible_name && (
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3" /> {eq.responsible_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {eqTasks.map((t) => {
                    const pr = PRIORITY_META[t.priority];
                    const due = t.due_date ? new Date(t.due_date) : null;
                    const overdue = due && isPast(due);
                    const assignee = t.assignee_id ? members.find((m) => m.user_id === t.assignee_id) : null;
                    const statusLabel = PLANNER_COLUMNS.find((c) => c.id === t.status)?.title;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className="w-full text-left rounded-md border border-border/50 px-2.5 py-2 hover:bg-accent/40 hover:border-primary/40 transition"
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{t.title}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                              <span>{statusLabel}</span>
                              {assignee && <span>· {assignee.full_name || assignee.email}</span>}
                              {due && (
                                <span className={cn("inline-flex items-center gap-0.5 font-numeric", overdue && "text-destructive font-medium")}>
                                  <Calendar className="h-3 w-3" />
                                  {format(due, "d MMM", { locale: ru })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PlannerTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
    </div>
  );
}
