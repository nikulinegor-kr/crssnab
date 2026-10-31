import { useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useExecutivePanel } from "@/hooks/useExecutivePanel";
import type { PlannerTask } from "@/hooks/usePlannerTasks";
import { ExecKpiTiles } from "@/components/executive/ExecKpiTiles";
import { ExecAttentionList } from "@/components/executive/ExecAttentionList";
import { ExecObjectsLoad } from "@/components/executive/ExecObjectsLoad";
import { ExecRecentEvents } from "@/components/executive/ExecRecentEvents";
import { ExecSectionsGrid } from "@/components/executive/ExecSectionsGrid";
import { ExecWarehouseMoves } from "@/components/executive/ExecWarehouseMoves";
import { pluralRu } from "@/lib/pluralRu";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXEC_LINKS } from "@/lib/executivePanel";

const TaskDialog = lazy(() => import("@/components/planner/PlannerTaskDialog").then(m => ({ default: m.PlannerTaskDialog })));
const taskColumns = "id,organization_id,object_id,stage_id,request_id,equipment_id,equipment_ids,parent_task_id,title,description,status,priority,assignee_id,reviewer_id,co_assignee_ids,department_id,requires_acceptance,accepted_at,blocked_reason,blocked_until,change_reason,created_by,start_date,due_date,completed_at,position,tags,checklist,attachments,is_private,recurrence,estimated_hours,actual_hours,source,source_rule,due_time,archived_at,created_at,updated_at";

export default function ExecutivePanelPage() {
  const panel = useExecutivePanel();
  const qc = useQueryClient();
  const [task, setTask] = useState<PlannerTask | null>(null);
  const [openingTask, setOpeningTask] = useState(false);
  const openTask = async (id: string) => {
    if (!panel.orgId || openingTask) return;
    setOpeningTask(true);
    try {
      const { data, error } = await supabase.from("planner_tasks").select(taskColumns).eq("organization_id", panel.orgId).eq("id", id).single();
      if (error) throw error;
      setTask(data as unknown as PlannerTask);
    } catch { toast.error("Не удалось открыть задачу"); }
    finally { setOpeningTask(false); }
  };
  return <div className="mx-auto max-w-7xl min-w-0 space-y-3 pb-[env(safe-area-inset-bottom)] text-foreground" aria-busy={openingTask}>
    <header><h1 className="text-xl font-semibold sm:text-2xl">Панель руководителя</h1><p className="mt-1 text-xs text-muted-foreground">{format(new Date(), "d MMMM yyyy, EEEE", { locale: ru })}</p>
      {panel.orgId && <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        <Button variant="link" asChild className="h-auto min-h-11 sm:min-h-7 px-0 py-0 text-xs font-normal text-muted-foreground"><Link to={EXEC_LINKS.openRequests}>{panel.openRequests.isLoading ? <Skeleton className="h-4 w-8" /> : panel.openRequests.isError ? "—" : panel.openRequests.data} {pluralRu(panel.openRequests.data ?? 0, ["заявка", "заявки", "заявок"])} в работе</Link></Button><span>·</span>
        <Button variant="link" asChild className="h-auto min-h-11 sm:min-h-7 px-0 py-0 text-xs font-normal text-muted-foreground"><Link to={EXEC_LINKS.activeTasks}>{panel.activeTasks.isLoading ? <Skeleton className="h-4 w-8" /> : panel.activeTasks.isError ? "—" : panel.activeTasks.data} {pluralRu(panel.activeTasks.data ?? 0, ["активная задача", "активные задачи", "активных задач"])}</Link></Button>
      </div>}
    </header>
    {!panel.orgId ? <p className="text-sm text-muted-foreground">Выберите организацию</p> : <>
      <ExecKpiTiles {...panel} />
      <ExecSectionsGrid />
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1"><ExecAttentionList groups={panel.attention.groups} loading={panel.attention.isLoading} error={panel.attention.isError} onOpenTask={openTask} /></div>
        <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-start-1"><ExecWarehouseMoves orgId={panel.orgId} /><ExecObjectsLoad items={panel.objects.data ?? []} loading={panel.objects.isLoading} error={panel.objects.isError} /><ExecRecentEvents items={panel.events.data ?? []} loading={panel.events.isLoading} error={panel.events.isError} onOpenTask={openTask} /></div>
      </div>
    </>}
    {task && <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Открывается задача…</p>}><TaskDialog open task={task} onOpenChange={open => { if (!open) { setTask(null); void qc.invalidateQueries({ queryKey: ["executive", panel.orgId] }); } }} /></Suspense>}
  </div>;
}