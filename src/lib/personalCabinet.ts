import { isOpenRequest } from "./requestStaleness";
export function isMyRequest(request: { applicant_user_id?: string | null; created_by?: string | null }, userId: string | null) {
  return Boolean(userId && (request.applicant_user_id === userId || request.created_by === userId));
}
export function isMyOpenRequest(request: { status: string; applicant_user_id?: string | null; created_by?: string | null }, userId: string | null) {
  return isMyRequest(request, userId) && isOpenRequest(request);
}
export function taskStatistics(tasks: { completed_at: string | null; due_date: string | null; created_at: string }[], reworkCount: number) {
  const dated = tasks.filter(t => t.completed_at && t.due_date);
  const onTime = dated.filter(t => Date.parse(t.completed_at ?? "") <= Date.parse(t.due_date ?? "")).length;
  const durations = tasks.filter(t => t.completed_at).map(t => Math.max(0, Date.parse(t.completed_at ?? "") - Date.parse(t.created_at))).filter(Number.isFinite);
  return { completed: tasks.length, onTime: dated.length ? Math.round(onTime / dated.length * 100) : null, averageDays: durations.length ? durations.reduce((a,b) => a+b,0) / durations.length / 86_400_000 : null, rework: reworkCount };
}
