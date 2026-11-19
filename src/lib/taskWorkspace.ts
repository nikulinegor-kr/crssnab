import type { PlannerTask } from '@/hooks/usePlannerTasks';
export type TaskGroup = 'late' | 'today' | 'later' | 'undated' | 'done';
export function taskGroup(task: Pick<PlannerTask, 'status' | 'due_date'>, today: string): TaskGroup {
  if (task.status === 'done') return 'done';
  const day = task.due_date?.slice(0, 10);
  if (!day) return 'undated';
  return day < today ? 'late' : day === today ? 'today' : 'later';
}
export function quickTaskAcceptance(assigneeId: string, userId: string) {
  return { requires_acceptance: assigneeId !== userId, reviewer_id: assigneeId !== userId ? userId : null };
}
export function taskTone(status: string) {
  return status === 'done' ? 'green' : status === 'review' || status === 'rework' ? 'orange' : ['backlog', 'todo', 'waiting'].includes(status) ? 'gray' : '';
}
