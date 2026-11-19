import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTaskHubIdentity } from '@/hooks/useTaskHubIdentity';
import { usePlannerMembers } from '@/hooks/useOrgMembers';
import { useCreatePlannerTask } from '@/hooks/usePlannerTasks';
import { quickTaskAcceptance } from '@/lib/taskWorkspace';
import { TaskWorkspaceDetail } from '@/components/tasks/TaskWorkspaceDetail';
import '@/components/workspace/workspace.css';
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
  const tab = TASK_TABS.find(t => t.id === params.get("tab"))?.id ?? "mine";
  const requestedPage = Number(params.get("page"));
  const page = Number.isFinite(requestedPage) ? Math.max(0, Math.floor(requestedPage)) : 0;
  const filters = { search: params.get("search") ?? "", object: params.get("object") ?? "", assignee: params.get("assignee") ?? "", priority: params.get("priority") ?? "", department: params.get("department") ?? "", overdue: params.get("overdue") === "1", today: params.get("today") === "1" };
  const panel = useTasksHub(tab, filters, page);
  const { data: members = [] } = useOrgMembers({ includeInactive: true });
  const { data: departments = [] } = useDepartments();
  const qc = useQueryClient();
  const identity = useTaskHubIdentity();
  const { data: assignable = [] } = usePlannerMembers();
  const create = useCreatePlannerTask();
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssignee, setQuickAssignee] = useState('');
  const [quickDate, setQuickDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<PlannerTask | null>(null);
  useEffect(() => { setSelected(null); }, [panel.orgId]);
  useEffect(() => { if (!quickAssignee && identity.userId) setQuickAssignee(identity.userId); }, [identity.userId, quickAssignee]);
  const [search, setSearch] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [task, setTask] = useState<PlannerTask | null>(null);
  const taskParam = params.get("task");
  const updateParam = useCallback((key: string, value: string | null) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
  }), [setParams]);
  useEffect(() => { setSearch(filters.search); }, [filters.search]);
  useEffect(() => {
    if (search === filters.search) return;
    const timeout = setTimeout(() => updateParam("search", search || null), 350);
    return () => clearTimeout(timeout);
  }, [search, filters.search, updateParam]);
  useEffect(() => {
    const id = taskParam;
    if (!id || !panel.orgId) return;
    let cancelled = false;
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data, error } = await supabase.from("planner_tasks").select("*").eq("id", id).eq("organization_id", panel.orgId).single();
      if (cancelled) return;
      if (error) { const { toast } = await import("sonner"); toast.error(error.message); return; }
      setSelected(data as unknown as PlannerTask);
    });
    return () => { cancelled = true; };
  }, [taskParam, panel.orgId]);
  const openTask = (value: PlannerTask) => setSelected(value);
  const edit = (value: PlannerTask | null) => { setSelected(null); setTask(value); setDialogOpen(true); };
  const tabs = ['mine', 'created', 'control', 'all', 'done'] as const;
  const count = panel.list.data?.count ?? 0;
  return <div className="cw-workspace">
    <header className="cw-heading"><div><h1>Задачи</h1><p>{format(new Date(), 'EEEE, d MMMM', { locale: ru })}</p></div><div className="cw-heading-actions"><Button aria-label="Новая задача" onClick={() => edit(null)}><Plus /><span>Новая задача</span></Button></div></header>
    <nav className="cw-tabs" role="tablist" aria-label="Список задач">{tabs.map(id => <button role="tab" aria-selected={tab === id} key={id} onClick={() => { setSelected(null); updateParam('tab', id); }}>{id === 'done' ? 'Выполненные' : TASK_TABS.find(t => t.id === id)?.label}</button>)}</nav>
    <div className="cw-summary"><button onClick={() => { updateParam('tab','all'); }}><strong>{panel.kpi.data?.[0] ?? '—'}</strong>активных</button><button className="cw-late" onClick={() => updateParam('tab','overdue')}><strong>{panel.kpi.data?.[2] ?? '—'}</strong>просрочено</button><button onClick={() => updateParam('tab','control')}><strong>{panel.kpi.data?.[3] ?? '—'}</strong>ждёт моей приёмки</button></div>
    <div className={`cw-grid ${selected ? 'has-detail' : ''}`}><div className="cw-main">
      <form className="cw-quick" onSubmit={async e => { e.preventDefault(); if (!quickTitle.trim() || !quickAssignee || !identity.userId || create.isPending) return; try { await create.mutateAsync({ title: quickTitle.trim(), assignee_id: quickAssignee, due_date: quickDate ? new Date(quickDate).toISOString() : null, ...quickTaskAcceptance(quickAssignee, identity.userId) }); setQuickTitle(''); } catch { /* Mutation reports failure. */ } }}>
        <div className="cw-quick-title"><Plus size={18} /><Input aria-label="Что нужно сделать" placeholder="Что нужно сделать?" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} maxLength={500} /></div>
        <div className="cw-quick-bottom"><div><TaskLookupSelect label="Исполнитель" value={quickAssignee || null} options={assignable.map(m => ({id:m.user_id,name:m.full_name || m.email || 'Сотрудник'}))} onChange={value => setQuickAssignee(value || '')} /></div><input type="date" aria-label="Срок задачи" value={quickDate} onChange={e => setQuickDate(e.target.value)} /><Button type="submit" disabled={!quickTitle.trim() || !quickAssignee || !identity.userId || create.isPending}>{create.isPending ? 'Создаём…' : 'Поставить'}</Button></div>
      </form>
      <div className="cw-toolbar"><div className="cw-search"><Search /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти задачу" aria-label="Поиск задач" /></div><Button variant="outline" className={tab === 'overdue' ? 'cw-filter-active' : ''} onClick={() => updateParam('tab', tab === 'overdue' ? 'mine' : 'overdue')}>Просроченные</Button><Button variant="outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-label="Фильтры задач"><SlidersHorizontal /></Button></div>
      {showFilters && <div className="cw-toolbar">
        <div className="min-w-36 flex-1"><TaskLookupSelect label="Объект" value={filters.object || null} options={panel.objects.data ?? []} onChange={value => updateParam('object', value)} /></div>
        <div className="min-w-36 flex-1"><TaskLookupSelect label="Исполнитель" value={filters.assignee || null} options={members.map(m => ({ id: m.user_id, name: m.full_name || m.email || '—' }))} onChange={value => updateParam('assignee', value)} /></div>
        <div className="min-w-32 flex-1"><TaskLookupSelect label="Приоритет" value={filters.priority || null} options={Object.entries(PRIORITY_META).map(([id, meta]) => ({ id, name: meta.label }))} onChange={value => updateParam('priority', value)} /></div>
        {departments.length > 0 && <div className="min-w-36 flex-1"><TaskLookupSelect label="Подразделение" value={filters.department || null} options={departments} onChange={value => updateParam('department', value)} /></div>}
      </div>}
      <section aria-busy={panel.list.isFetching}>{!panel.orgId ? <p className="cw-empty">Выберите организацию</p> : panel.list.isError ? <div role="alert" className="cw-empty"><p>Не удалось загрузить задачи</p><Button variant="outline" onClick={() => void panel.list.refetch()}>Повторить</Button></div> : <TasksHubList tasks={panel.list.data?.rows ?? []} members={members} objects={panel.objects.data ?? []} loading={panel.list.isLoading} empty={TASK_TABS.find(t => t.id === tab)?.empty ?? 'Задач нет'} onOpen={openTask} selectedId={selected?.id} />}</section>
      <footer className="cw-page-footer"><span>{count ? `${page * 50 + 1}–${Math.min((page + 1) * 50, count)} из ${count}` : '0 задач'}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Предыдущая страница" disabled={page === 0 || panel.list.isFetching} onClick={() => updateParam('page', String(page - 1))}><ChevronLeft /></Button><span>{page + 1}</span><Button variant="outline" size="icon" aria-label="Следующая страница" disabled={(page + 1) * 50 >= count || panel.list.isFetching} onClick={() => updateParam('page', String(page + 1))}><ChevronRight /></Button></div></footer>
    </div>{selected && <TaskWorkspaceDetail key={selected.id} task={panel.list.data?.rows.find(t => t.id === selected.id) ?? selected} members={members} objects={panel.objects.data ?? []} onClose={() => { setSelected(null); if (params.has('task')) updateParam('task', null); }} onEdit={() => edit(panel.list.data?.rows.find(t => t.id === selected.id) ?? selected)} onUpdated={setSelected} />}</div>
    {dialogOpen && <Suspense fallback={<Skeleton className="h-24" />}><TaskDialog open workspace defaultAssigneeId={identity.userId} task={task} onOpenChange={open => { setDialogOpen(open); if (!open) { setTask(null); invalidatePlannerTaskQueries(qc); } }} /></Suspense>}
  </div>;
}
