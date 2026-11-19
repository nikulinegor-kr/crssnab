import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WorkspacePanel, WorkspaceAvatar } from '@/components/workspace/WorkspacePanel';
import { useTaskHubIdentity } from '@/hooks/useTaskHubIdentity';
import { useUpdatePlannerTask, PLANNER_STATUS_LABELS, PRIORITY_META, type PlannerTask } from '@/hooks/usePlannerTasks';
import { useAddPlannerComment, usePlannerTaskActivity, usePlannerTaskComments } from '@/hooks/usePlannerTaskComments';
import { supabase } from '@/integrations/supabase/client';
import type { OrgMember } from '@/hooks/useOrgMembers';
import { TaskStatusActions } from './TaskStatusActions';
import { taskTone } from '@/lib/taskWorkspace';

export function TaskWorkspaceDetail({ task, members, objects, onClose, onEdit, onUpdated }: {
  task: PlannerTask; members: OrgMember[]; objects: { id: string; name: string }[]; onClose: () => void; onEdit: () => void; onUpdated: (task: PlannerTask) => void;
}) {
  const { userId, isAdmin } = useTaskHubIdentity();
  const update = useUpdatePlannerTask();
  const comments = usePlannerTaskComments(task.id);
  const activity = usePlannerTaskActivity(task.id);
  const addComment = useAddPlannerComment();
  const [text, setText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const canExecute = isAdmin || !!userId && [task.assignee_id, task.created_by, ...(task.co_assignee_ids ?? [])].includes(userId);
  const equipment = useQuery({ queryKey: ['task-workspace-equipment', task.organization_id, task.equipment_id], enabled: !!task.equipment_id,
    queryFn: async () => { const { data, error } = await supabase.from('equipment').select('id,brand,model').eq('organization_id', task.organization_id).eq('id', task.equipment_id!).maybeSingle(); if (error) throw error; return data; } });
  const name = (id: string | null) => members.find(m => m.user_id === id)?.full_name || members.find(m => m.user_id === id)?.email || 'Не назначен';
  const openFile = async (path: string | undefined, url: string) => {
    try {
      let target = url;
      if (path) { const { data, error } = await supabase.storage.from('planner-attachments').createSignedUrl(path, 300); if (error) throw error; target = data.signedUrl; }
      if (!/^https?:\/\//i.test(target)) throw new Error('Файл недоступен');
      window.open(target, '_blank', 'noopener,noreferrer');
    } catch { toast.error('Не удалось открыть файл'); }
  };
  return <WorkspacePanel title={task.title} badge={<span className={`cw-status ${taskTone(task.status)}`}>{PLANNER_STATUS_LABELS[task.status]}</span>} onClose={onClose}
    footer={<><Button variant="outline" onClick={onEdit}>Редактировать</Button><TaskStatusActions primary task={task} onUpdated={onUpdated} /></>}>
    <section className="cw-detail-section"><dl className="cw-fields">
      <div><dt>Исполнитель</dt><dd className="cw-person"><WorkspaceAvatar name={name(task.assignee_id)} />{name(task.assignee_id)}</dd></div>
      <div><dt>Срок</dt><dd>{task.due_date ? format(new Date(task.due_date), 'd MMMM yyyy', { locale: ru }) : 'Без срока'}{task.due_time ? `, ${task.due_time.slice(0,5)}` : ''}</dd></div>
      <div><dt>Приоритет</dt><dd>{PRIORITY_META[task.priority]?.label}</dd></div>
      <div><dt>Объект</dt><dd>{objects.find(o => o.id === task.object_id)?.name ?? 'Не указан'}</dd></div>
      {task.equipment_id && <div><dt>Техника</dt><dd>{equipment.isError ? 'Не удалось загрузить' : equipment.data ? <a href={`/equipment/${equipment.data.id}`}>{equipment.data.brand} {equipment.data.model}</a> : 'Загрузка…'}</dd></div>}
      {task.requires_acceptance && <div><dt>Приёмка</dt><dd>{name(task.reviewer_id)}</dd></div>}
    </dl></section>
    <section className="cw-detail-section"><h3>Что нужно сделать</h3><p>{task.description || 'Описание не добавлено'}</p>
      {(task.checklist ?? []).map(item => <label className={`cw-check ${item.done ? 'complete' : ''}`} key={item.id}><input type="checkbox" checked={item.done} disabled={!canExecute || task.status === 'done' || update.isPending}
        onChange={async () => { const next = task.checklist.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry); try { await update.mutateAsync({ id: task.id, patch: { checklist: next } }); onUpdated({ ...task, checklist: next }); } catch { /* Mutation reports failure. */ } }} /><span>{item.text}</span></label>)}
    </section>
    {task.blocked_reason && task.status === 'waiting' && <section className="cw-detail-section"><h3>Причина ожидания</h3><p>{task.blocked_reason}</p></section>}
    {task.change_reason && task.status === 'rework' && <section className="cw-detail-section"><h3>Что доработать</h3><p>{task.change_reason}</p></section>}
    <section className="cw-detail-section"><h3>Вложения</h3>{task.attachments?.length ? task.attachments.map((file, i) => <button className="cw-file w-full text-left mb-2" key={file.path || i} onClick={() => void openFile(file.path, file.url)}><FileText size={18} />{file.name}</button>) : <p>Файлы пока не добавлены</p>}</section>
    <section className="cw-detail-section"><Button variant="ghost" className="px-0" onClick={() => setShowComments(!showComments)}>Комментарии ({comments.data?.length ?? 0})</Button>
      {showComments && <>{comments.isError && <p role="alert">Не удалось загрузить комментарии</p>}{comments.data?.map(comment => <p key={comment.id}><strong>{name(comment.user_id)}</strong><br />{comment.content}</p>)}<Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Написать комментарий" aria-label="Новый комментарий" /><Button className="mt-2" disabled={!text.trim() || addComment.isPending} onClick={async () => { try { await addComment.mutateAsync({ taskId: task.id, content: text.trim() }); setText(''); } catch { /* Mutation reports failure. */ } }}>Отправить</Button></>}
    </section>
    <section className="cw-detail-section"><h3>История</h3>{activity.isError ? <p role="alert">Не удалось загрузить историю</p> : <ul className="cw-timeline">{activity.data?.slice(0, 8).map(item => <li key={item.id}>{item.description || item.action}{item.reason && <p>{item.reason}</p>}<small>{format(new Date(item.created_at), 'dd.MM · HH:mm')} · {name(item.user_id)}</small></li>)}{!activity.isLoading && !activity.data?.length && <li>История пока пуста</li>}</ul>}</section>
  </WorkspacePanel>;
}
