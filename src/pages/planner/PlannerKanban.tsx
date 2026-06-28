import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePlannerTasks,
  useUpdatePlannerTask,
  PLANNER_COLUMNS,
  type PlannerTask,
  type PlannerTaskStatus,
} from "@/hooks/usePlannerTasks";
import { KanbanColumn, KanbanCard } from "@/components/planner/KanbanColumn";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";

export default function PlannerKanban() {
  const { data: tasks = [], isLoading } = usePlannerTasks();
  const update = useUpdatePlannerTask();
  const [activeTask, setActiveTask] = useState<PlannerTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<PlannerTask | null>(null);
  const [dialogStatus, setDialogStatus] = useState<PlannerTaskStatus>("backlog");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const grouped = useMemo(() => {
    const map: Record<PlannerTaskStatus, PlannerTask[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasks.find((x) => x.id === e.active.id);
    if (t) setActiveTask(t);
  };

  const handleDragOver = (_e: DragOverEvent) => {
    // no-op visual reorder for now; status change applied on drop
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    // Determine target status: drop on column or on card
    let targetStatus: PlannerTaskStatus | undefined;
    const overData: any = over.data?.current;
    if (overData?.type === "column") targetStatus = overData.status;
    else if (overData?.type === "task") targetStatus = overData.task.status;

    if (!targetStatus || targetStatus === dragged.status) return;
    await update.mutateAsync({ id: dragged.id, patch: { status: targetStatus } });
  };

  const openNew = (status: PlannerTaskStatus) => {
    setDialogTask(null);
    setDialogStatus(status);
    setDialogOpen(true);
  };

  const openEdit = (t: PlannerTask) => {
    setDialogTask(t);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[60dvh] w-[280px] shrink-0" />)}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Перетаскивайте карточки между колонками
        </div>
        <Button size="sm" onClick={() => openNew("backlog")}>
          <Plus className="h-4 w-4 mr-1" /> Новая задача
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
          {PLANNER_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={grouped[col.id]}
              onAddClick={() => openNew(col.id)}
              onCardClick={openEdit}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <KanbanCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <PlannerTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={dialogTask}
        defaultStatus={dialogStatus}
      />
    </>
  );
}
