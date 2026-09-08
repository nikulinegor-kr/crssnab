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
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { PlannerBoardSkeleton } from "@/components/planner/PlannerBoardSkeleton";
import { PeopleColumn } from "@/components/planner/PeopleColumn";
import { UnassignedRequestCard } from "@/components/planner/UnassignedRequestCard";
import { KanbanCard } from "@/components/planner/KanbanColumn";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import {
  usePlannerTasks,
  useUpdatePlannerTask,
  useCreatePlannerTask,
  type PlannerTask,
} from "@/hooks/usePlannerTasks";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { usePlannerMembers } from "@/hooks/useOrgMembers";
import { useRequestsWithoutTasks, type RequestWithoutTask } from "@/hooks/useRequestsWithoutTasks";

const UNASSIGNED = "unassigned";

const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  editor: "Редактор",
  member: "Сотрудник",
  viewer: "Наблюдатель",
};

export default function PlannerPeople() {
  const { data: allTasks = [], isLoading } = usePlannerTasks();
  const filters = usePlannerFilters();
  const { data: members = [] } = usePlannerMembers();
  const [requestLimit, setRequestLimit] = useState(20);
  const { data: openRequests = [] } = useRequestsWithoutTasks(200);
  const update = useUpdatePlannerTask();
  const create = useCreatePlannerTask();
  const { toast } = useToast();

  const [activeTask, setActiveTask] = useState<PlannerTask | null>(null);
  const [activeRequest, setActiveRequest] = useState<RequestWithoutTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<PlannerTask | null>(null);
  const [dialogAssignee, setDialogAssignee] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const tasks = useMemo(() => filters.apply(allTasks), [allTasks, filters]);

  const byAssignee = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    map.set(UNASSIGNED, []);
    for (const m of members) map.set(m.user_id, []);
    for (const t of tasks) {
      const key = t.assignee_id && map.has(t.assignee_id) ? t.assignee_id : UNASSIGNED;
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks, members]);

  const visibleRequests = useMemo(() => {
    const q = filters.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = openRequests.filter((r) => {
      if (filters.objectId && r.object_id !== filters.objectId) return false;
      if (filters.assigneeId) return false;
      if (q.length) {
        const hay = `${r.description ?? ""} ${r.request_number ?? ""} ${r.status ?? ""}`.toLowerCase();
        if (!q.every((term) => hay.includes(term))) return false;
      }
      return true;
    });
    return { list: filtered.slice(0, requestLimit), total: filtered.length };
  }, [openRequests, filters.objectId, filters.assigneeId, filters.searchQuery, requestLimit]);

  const openTask = (t: PlannerTask) => {
    setDialogTask(t);
    setDialogAssignee(null);
    setDialogOpen(true);
  };

  const newTaskFor = (userId: string | null) => {
    setDialogTask(null);
    setDialogAssignee(userId);
    setDialogOpen(true);
  };

  const nameOf = (userId: string | null) => {
    if (!userId) return "Не распределено";
    const m = members.find((x) => x.user_id === userId);
    return m?.full_name || m?.email || "Сотрудник";
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data: any = e.active.data?.current;
    if (data?.type === "task") setActiveTask(data.task);
    if (data?.type === "request") setActiveRequest(data.request);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const dragged: any = e.active.data?.current;
    setActiveTask(null);
    setActiveRequest(null);
    const overData: any = e.over?.data?.current;
    if (!overData) return;

    let columnId: string | undefined = overData.columnId;
    if (!columnId && overData.type === "task") {
      columnId = overData.task.assignee_id ?? UNASSIGNED;
    }
    if (!columnId) return;
    const targetUserId = columnId === UNASSIGNED ? null : columnId;

    if (dragged?.type === "task") {
      const task: PlannerTask = dragged.task;
      const prev = task.assignee_id ?? null;
      if (prev === targetUserId) return;
      await update.mutateAsync({ id: task.id, patch: { assignee_id: targetUserId } as any });
      toast({
        title: targetUserId ? `Назначено: ${nameOf(targetUserId)}` : "Исполнитель снят",
        description: task.title,
        duration: 5000,
        action: (
          <ToastAction
            altText="Отменить"
            onClick={() => update.mutate({ id: task.id, patch: { assignee_id: prev } as any })}
          >
            Отменить
          </ToastAction>
        ),
      });
      return;
    }

    if (dragged?.type === "request") {
      const r: RequestWithoutTask = dragged.request;
      const created: any = await create.mutateAsync({
        title: r.description || r.request_number || "Задача по заявке",
        assignee_id: targetUserId,
        request_id: r.id,
        object_id: r.object_id,
        due_date: r.delivery_date,
        source: "crm_request",
      } as any);
      if (created?.id) {
        toast({
          title: targetUserId ? `Задача создана для ${nameOf(targetUserId)}` : "Задача создана",
          description: r.description || "",
          duration: 5000,
          action: (
            <ToastAction altText="Отменить" onClick={() => update.mutate({ id: created.id, patch: { archived_at: new Date().toISOString() } as any })}>
              Отменить
            </ToastAction>
          ),
        });
      }
    }
  };

  if (isLoading) return <PlannerBoardSkeleton />;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0 h-full">
          <PeopleColumn
            id={UNASSIGNED}
            name="Не распределено"
            role={`${byAssignee.get(UNASSIGNED)?.length ?? 0} задач · ${visibleRequests.total} заявок`}
            tasks={byAssignee.get(UNASSIGNED) ?? []}
            onCardClick={openTask}
            onAddClick={() => newTaskFor(null)}
          >
            {visibleRequests.list.map((r) => (
              <UnassignedRequestCard key={r.id} request={r} />
            ))}
            {visibleRequests.total > visibleRequests.list.length && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[11px]"
                onClick={() => setRequestLimit((n) => n + 20)}
              >
                Показать ещё ({visibleRequests.total - visibleRequests.list.length})
              </Button>
            )}
          </PeopleColumn>

          {members
            .filter((m) => !filters.assigneeId || m.user_id === filters.assigneeId)
            .map((m) => (
              <PeopleColumn
                key={m.user_id}
                id={m.user_id}
                name={m.full_name || m.email || "—"}
                role={m.position || ROLE_LABEL[m.role ?? ""] || null}
                tasks={byAssignee.get(m.user_id) ?? []}
                onCardClick={openTask}
                onAddClick={() => newTaskFor(m.user_id)}
              />
            ))}
        </div>

        <DragOverlay>
          {activeTask ? <KanbanCard task={activeTask} onClick={() => {}} /> : null}
          {activeRequest ? <UnassignedRequestCard request={activeRequest} /> : null}
        </DragOverlay>
      </DndContext>

      <PlannerTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={dialogTask}
        defaultAssigneeId={dialogAssignee ?? undefined}
      />
    </>
  );
}
