import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MapPin, Truck } from "lucide-react";
import { format, isPast } from "date-fns";
import { ru } from "date-fns/locale";
import { usePlannerTasks, PRIORITY_META, PLANNER_COLUMNS, type PlannerTask } from "@/hooks/usePlannerTasks";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { cn } from "@/lib/utils";

const NO_OBJECT = "__no_obj__";
const NO_EQUIP = "__no_eq__";

export default function PlannerByObject() {
  const { data: allTasks = [] } = usePlannerTasks();
  const filters = usePlannerFilters();
  const tasks = useMemo(() => filters.apply(allTasks), [allTasks, filters]);
  const { equipmentMap, objectMap } = usePlannerLookups();
  const { data: members = [] } = useOrgMembers();
  const [editing, setEditing] = useState<PlannerTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Build tree: object → equipment → tasks
  const tree = useMemo(() => {
    const root = new Map<string, { name: string; equipMap: Map<string, { label: string; tasks: PlannerTask[] }> }>();
    for (const t of tasks) {
      const eqIds = t.equipment_ids?.length ? t.equipment_ids : (t.equipment_id ? [t.equipment_id] : []);
      const firstEq = eqIds[0] ? equipmentMap.get(eqIds[0]) : null;
      const objId = t.object_id || firstEq?.current_object_id || NO_OBJECT;
      const objName = objId === NO_OBJECT ? "Без объекта" : (objectMap.get(objId)?.name || "Объект");
      const bucket = root.get(objId) ?? { name: objName, equipMap: new Map() };
      root.set(objId, bucket);

      if (eqIds.length === 0) {
        const key = NO_EQUIP;
        const eb = bucket.equipMap.get(key) ?? { label: "Без техники", tasks: [] };
        eb.tasks.push(t);
        bucket.equipMap.set(key, eb);
      } else {
        for (const eid of eqIds) {
          const eq = equipmentMap.get(eid);
          const label = eq ? equipmentLabel(eq) : "Техника";
          const eb = bucket.equipMap.get(eid) ?? { label, tasks: [] };
          eb.tasks.push(t);
          bucket.equipMap.set(eid, eb);
        }
      }
    }
    return Array.from(root.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, v]) => ({
        id,
        name: v.name,
        equipment: Array.from(v.equipMap.entries())
          .sort((a, b) => a[1].label.localeCompare(b[1].label))
          .map(([eid, ev]) => ({ id: eid, ...ev })),
      }));
  }, [tasks, equipmentMap, objectMap]);

  const openEdit = (t: PlannerTask) => {
    setEditing(t);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">По объектам</h2>
        <p className="text-xs text-muted-foreground">Иерархия: объект → техника → задачи</p>
      </div>

      {tree.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          Задач пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {tree.map((obj) => {
            const totalTasks = obj.equipment.reduce((n, e) => n + e.tasks.length, 0);
            return (
              <Card key={obj.id} className="overflow-hidden">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold flex-1 text-left">{obj.name}</span>
                    <Badge variant="secondary" className="font-numeric">{totalTasks}</Badge>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/40 divide-y divide-border/40">
                    {obj.equipment.map((eq) => (
                      <div key={eq.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Truck className={cn("h-3.5 w-3.5", eq.id === NO_EQUIP ? "text-muted-foreground" : "text-blue-500")} />
                          <span className="text-xs font-medium">{eq.label}</span>
                          <Badge variant="outline" className="ml-auto font-numeric text-[10px]">{eq.tasks.length}</Badge>
                        </div>
                        <div className="space-y-1 pl-5">
                          {eq.tasks.map((t) => {
                            const pr = PRIORITY_META[t.priority];
                            const due = t.due_date ? new Date(t.due_date) : null;
                            const overdue = due && isPast(due) && t.status !== "done";
                            const assignee = t.assignee_id ? members.find((m) => m.user_id === t.assignee_id) : null;
                            const statusLabel = PLANNER_COLUMNS.find((c) => c.id === t.status)?.title;
                            return (
                              <button
                                key={t.id}
                                onClick={() => openEdit(t)}
                                className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/40 flex items-center gap-2 group"
                              >
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", pr.dot)} />
                                <span className={cn("text-sm flex-1 truncate", t.status === "done" && "line-through text-muted-foreground")}>
                                  {t.title}
                                </span>
                                <span className="text-[10px] text-muted-foreground hidden sm:inline">{statusLabel}</span>
                                {assignee && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px] hidden md:inline">
                                    {assignee.full_name || assignee.email}
                                  </span>
                                )}
                                {due && (
                                  <span className={cn("text-[10px] font-numeric", overdue && "text-destructive font-medium")}>
                                    {format(due, "d MMM", { locale: ru })}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      <PlannerTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
    </div>
  );
}
