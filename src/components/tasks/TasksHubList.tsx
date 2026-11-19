import { format } from 'date-fns';
import { ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PLANNER_STATUS_LABELS, type PlannerTask } from '@/hooks/usePlannerTasks';
import type { OrgMember } from '@/hooks/useOrgMembers';
import { WorkspaceAvatar, WorkspaceEmpty } from '@/components/workspace/WorkspacePanel';
import { taskGroup, taskTone, type TaskGroup } from '@/lib/taskWorkspace';

export function TasksHubList({ tasks, members, objects, loading, empty, onOpen, selectedId }: {
  tasks: PlannerTask[]; members: OrgMember[]; objects: { id: string; name: string }[]; loading: boolean; empty: string; onOpen: (task: PlannerTask) => void; selectedId?: string;
}) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  if (!tasks.length) return <WorkspaceEmpty><h2>{empty}</h2><p>Измените фильтры или создайте задачу.</p></WorkspaceEmpty>;
  const today = format(new Date(), 'yyyy-MM-dd');
  const groups: { id: TaskGroup; title: string }[] = [{id:'late',title:'Просрочено'},{id:'today',title:'Сегодня'},{id:'later',title:'Позже'},{id:'undated',title:'Без срока'},{id:'done',title:'Выполненные'}];
  const names = new Map(members.map(m => [m.user_id, m.full_name || m.email || 'Не назначен']));
  return <>{groups.map(group => { const rows = tasks.filter(t => taskGroup(t, today) === group.id); if (!rows.length) return null;
    return <section key={group.id} className={`cw-task-group ${group.id === 'late' ? 'late' : ''}`}><h2>{group.title}<small>{rows.length}</small></h2><div className="cw-surface">{rows.map(task => <article className="cw-task-row" key={task.id} data-selected={selectedId === task.id}>
      <button className={`cw-task-ring ${task.status === 'done' ? 'done' : ''}`} onClick={() => onOpen(task)} aria-label={`Открыть задачу: ${task.title}`} />
      <div><button className="cw-name" onClick={() => onOpen(task)}>{task.title}</button><div className="cw-task-meta"><span className={`cw-status ${taskTone(task.status)}`}>{PLANNER_STATUS_LABELS[task.status]}</span>
        <span className={group.id === 'late' ? 'cw-late' : ''}>{task.due_date ? `${task.due_date.slice(8,10)}.${task.due_date.slice(5,7)}${task.due_time ? ` · ${task.due_time.slice(0,5)}` : ''}` : 'Без срока'}</span>
        {task.object_id && <span>{objects.find(o => o.id === task.object_id)?.name ?? 'Объект не найден'}</span>}
        {!!task.checklist?.length && <span><ListChecks />{task.checklist.filter(i => i.done).length}/{task.checklist.length}</span>}
      </div></div><WorkspaceAvatar name={names.get(task.assignee_id ?? '') ?? 'Не назначен'} />
    </article>)}</div></section>; })}</>;
}
