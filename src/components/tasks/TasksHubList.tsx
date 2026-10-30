import { format, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PLANNER_STATUS_LABELS, PRIORITY_META, type PlannerTask } from "@/hooks/usePlannerTasks";
import type { OrgMember } from "@/hooks/useOrgMembers";
import { TaskStatusActions } from "./TaskStatusActions";
import { cn } from "@/lib/utils";

export function TasksHubList({ tasks, members, objects, loading, empty, onOpen }: {
  tasks: PlannerTask[]; members: OrgMember[]; objects: { id: string; name: string }[];
  loading: boolean; empty: string; onOpen: (task: PlannerTask) => void;
}) {
  const names = new Map(members.map(m => [m.user_id, m.full_name || m.email || "—"]));
  const objectNames = new Map(objects.map(o => [o.id, o.name]));
  const due = (task: PlannerTask) => task.due_date ? format(new Date(task.due_date), "dd.MM.yyyy") : "—";
  const overdue = (task: PlannerTask) => task.status !== "done" && !!task.due_date && new Date(task.due_date) < startOfDay(new Date());
  if (loading) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 md:h-14" />)}</div>;
  if (!tasks.length) return <p className="py-16 text-center text-sm text-muted-foreground">{empty}</p>;
  return <>
    <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>{["Название", "Статус", "Приоритет", "Исполнитель", "Объект", "Срок", "Контролёр", ""].map((label, i) => <th key={i} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>
      {tasks.map(task => <tr key={task.id} className="cursor-pointer border-b border-border hover:bg-accent/40" onClick={() => onOpen(task)}>
        <td className="min-w-48 max-w-80 px-3 py-3"><Button variant="link" className="h-auto w-full justify-start whitespace-normal p-0 text-left text-foreground" onClick={e => { e.stopPropagation(); onOpen(task); }}>{task.title}</Button></td>
        <td className="px-3 py-3"><Badge variant="outline" className="whitespace-nowrap">{PLANNER_STATUS_LABELS[task.status]}</Badge></td>
        <td className="px-3 py-3 whitespace-nowrap">{PRIORITY_META[task.priority]?.label ?? "—"}</td>
        <td className="px-3 py-3">{names.get(task.assignee_id ?? "") ?? "—"}</td><td className="px-3 py-3">{objectNames.get(task.object_id ?? "") ?? "—"}</td>
        <td className={cn("px-3 py-3 whitespace-nowrap tabular-nums", overdue(task) && "text-destructive")}>{due(task)}</td><td className="px-3 py-3">{names.get(task.reviewer_id ?? "") ?? "—"}</td><td><TaskStatusActions task={task} menu /></td>
      </tr>)}
    </tbody></table></div>
    <div className="space-y-2 md:hidden">{tasks.map(task => <article key={task.id} className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2"><Button variant="link" className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left text-foreground" onClick={() => onOpen(task)}>{task.title}</Button><TaskStatusActions task={task} menu /></div>
      <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{PLANNER_STATUS_LABELS[task.status]}</Badge><span className="text-xs text-muted-foreground">{PRIORITY_META[task.priority]?.label ?? "—"}</span><span className={cn("ml-auto text-xs tabular-nums", overdue(task) && "text-destructive")}>{due(task)}</span></div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs"><dt className="text-muted-foreground">Исполнитель</dt><dd className="break-words">{names.get(task.assignee_id ?? "") ?? "—"}</dd><dt className="text-muted-foreground">Объект</dt><dd className="break-words">{objectNames.get(task.object_id ?? "") ?? "—"}</dd><dt className="text-muted-foreground">Контролёр</dt><dd>{names.get(task.reviewer_id ?? "") ?? "—"}</dd></dl>
    </article>)}</div>
  </>;
}