import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTasksHub } from "@/hooks/useTasksHub";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useDepartments } from "@/hooks/useDepartments";
import { PRIORITY_META, invalidatePlannerTaskQueries, type PlannerTask } from "@/hooks/usePlannerTasks";
import { TASK_TABS, type TaskTab } from "@/lib/taskHub";
import { TaskLookupSelect } from "@/components/tasks/TaskLookupSelect";
import { TasksHubList } from "@/components/tasks/TasksHubList";

const TaskDialog = lazy(() => import("@/components/planner/PlannerTaskDialog").then(module => ({ default: module.PlannerTaskDialog })));
export default function TasksHubPage() {
  const [params, setParams] = useSearchParams();
  const tab = TASK_TABS.find(t => t.id === params.get("tab"))?.id ?? "all";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const filters = { search: params.get("search") ?? "", object: params.get("object") ?? "", assignee: params.get("assignee") ?? "", priority: params.get("priority") ?? "", department: params.get("department") ?? "" };
  const panel = useTasksHub(tab, filters, page);
  const { data: members = [] } = useOrgMembers({ includeInactive: true });
  const { data: departments = [] } = useDepartments();
  const qc = useQueryClient();
  const [search, setSearch] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [task, setTask] = useState<PlannerTask | null>(null);
  const updateParam = (key: string, value: string | null) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
  });
  useEffect(() => { setSearch(filters.search); }, [filters.search]);
  useEffect(() => {
    if (search === filters.search) return;
    const timeout = setTimeout(() => updateParam("search", search || null), 350);
    return () => clearTimeout(timeout);
  }, [search, filters.search]);
  useEffect(() => {
    const id = params.get("task");
    if (!id || !panel.orgId) return;
    let cancelled = false;
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data, error } = await supabase.from("planner_tasks").select("*").eq("id", id).eq("organization_id", panel.orgId).single();
      if (cancelled) return;
      if (error) { const { toast } = await import("sonner"); toast.error(error.message); return; }
      setTask(data as unknown as PlannerTask); setDialogOpen(true);
    });
    return () => { cancelled = true; };
  }, [params.get("task"), panel.orgId]);
  const openTask = (selected: PlannerTask) => { setTask(selected); setDialogOpen(true); };
  const kpis: { label: string; tab: TaskTab }[] = [{ label: "Активные", tab: "all" }, { label: "Выполнено за 30 дней", tab: "done" }, { label: "Просрочено", tab: "overdue" }, { label: "Ждут моей приёмки", tab: "control" }];
  const count = panel.list.data?.count ?? 0;
  return <div className="mx-auto max-w-7xl space-y-5 text-foreground">
    <header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Задачи</h1><Button onClick={() => { setTask(null); setDialogOpen(true); }}><Plus />Новая задача</Button></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis.map((kpi, index) => <Button key={kpi.tab} variant="outline" className="h-24 min-w-0 flex-col items-start justify-center gap-2 px-4 text-left" onClick={() => updateParam("tab", kpi.tab)}>
      <span className="whitespace-normal text-xs text-muted-foreground">{kpi.label}</span>{panel.kpi.isLoading ? <Skeleton className="h-7 w-14" /> : <span className="text-2xl font-semibold tabular-nums">{panel.kpi.isError ? "—" : panel.kpi.data?.[index] ?? 0}</span>}
    </Button>)}</div>
    {panel.kpi.isError && <p role="alert" className="text-sm text-muted-foreground">Не удалось загрузить счётчики</p>}
    <Tabs value={tab} onValueChange={value => updateParam("tab", value)}><div className="overflow-x-auto"><TabsList className="h-10 w-max">{TASK_TABS.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList></div></Tabs>
    <div className="flex flex-wrap gap-2 lg:flex-nowrap"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию" aria-label="Поиск по названию" className="pl-9" /></div>
      <div className="min-w-36 flex-1"><TaskLookupSelect label="Объект" value={filters.object || null} options={panel.objects.data ?? []} onChange={value => updateParam("object", value)} /></div>
      <div className="min-w-36 flex-1"><TaskLookupSelect label="Исполнитель" value={filters.assignee || null} options={members.map(m => ({ id: m.user_id, name: m.full_name || m.email || "—" }))} onChange={value => updateParam("assignee", value)} /></div>
      <div className="min-w-32 flex-1"><TaskLookupSelect label="Приоритет" value={filters.priority || null} options={Object.entries(PRIORITY_META).map(([id, meta]) => ({ id, name: `${meta.label} (${id})` }))} onChange={value => updateParam("priority", value)} /></div>
      {departments.length > 0 && <div className="min-w-36 flex-1"><TaskLookupSelect label="Подразделение" value={filters.department || null} options={departments} onChange={value => updateParam("department", value)} /></div>}
    </div>
    <section aria-busy={panel.list.isFetching} className="min-h-96">
      {!panel.orgId ? <p className="py-12 text-sm text-muted-foreground">Выберите организацию</p> : panel.list.isError ? <div role="alert" className="py-12 text-sm"><p>Не удалось загрузить задачи</p><Button variant="outline" className="mt-3" onClick={() => void panel.list.refetch()}>Повторить</Button></div> : <TasksHubList tasks={panel.list.data?.rows ?? []} members={members} objects={panel.objects.data ?? []} loading={panel.list.isLoading} empty={TASK_TABS.find(t => t.id === tab)?.empty ?? "Задач нет"} onOpen={openTask} />}
    </section>
    <footer className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground tabular-nums">{count ? `${page * 50 + 1}–${Math.min((page + 1) * 50, count)} из ${count}` : "0 задач"}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" title="Предыдущая страница" aria-label="Предыдущая страница" disabled={page === 0 || panel.list.isFetching} onClick={() => updateParam("page", String(page - 1))}><ChevronLeft /></Button><span className="text-sm tabular-nums">{page + 1}</span><Button variant="outline" size="icon" title="Следующая страница" aria-label="Следующая страница" disabled={(page + 1) * 50 >= count || panel.list.isFetching} onClick={() => updateParam("page", String(page + 1))}><ChevronRight /></Button></div></footer>
    {dialogOpen && <Suspense fallback={<Skeleton className="h-24" />}><TaskDialog open task={task} onOpenChange={open => { setDialogOpen(open); if (!open) { setTask(null); invalidatePlannerTaskQueries(qc); if (params.has("task")) updateParam("task", null); } }} /></Suspense>}
  </div>;
}