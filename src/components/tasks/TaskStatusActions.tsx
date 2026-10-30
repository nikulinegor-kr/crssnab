import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { invalidatePlannerTaskQueries, type PlannerTask } from "@/hooks/usePlannerTasks";
import { useTaskHubIdentity } from "@/hooks/useTaskHubIdentity";
import { getAvailableTransitions, type TaskTransition } from "@/lib/taskHub";

export function TaskStatusActions({ task, menu = false, primary = false, onUpdated }: { task: PlannerTask; menu?: boolean; primary?: boolean; onUpdated?: (task: PlannerTask) => void }) {
  const { userId, isAdmin } = useTaskHubIdentity();
  const qc = useQueryClient();
  const [action, setAction] = useState<TaskTransition | null>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [pending, setPending] = useState(false);
  const actions = getAvailableTransitions(task, userId, isAdmin);
  const run = async (choice: TaskTransition) => {
    if (pending) return;
    if (choice.dialog && !reason.trim()) { toast.error(choice.dialog === "waiting" ? "Укажите причину ожидания" : "Укажите, что доработать"); return; }
    setPending(true);
    const patch = {
      status: choice.status,
      completed_at: choice.status === "done" ? new Date().toISOString() : null,
      ...(choice.dialog === "waiting" ? { blocked_reason: reason.trim(), blocked_until: until || null } : {}),
      ...(choice.dialog === "rework" ? { change_reason: reason.trim() } : {}),
    };
    try {
      const { data, error } = await supabase.from("planner_tasks").update(patch).eq("id", task.id).eq("organization_id", task.organization_id).select("*").single();
      if (error) throw error;
      invalidatePlannerTaskQueries(qc);
      onUpdated?.(data as unknown as PlannerTask);
      setAction(null);
      toast.success(choice.label);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Не удалось изменить статус"); }
    finally { setPending(false); }
  };
  const choose = (choice: TaskTransition) => {
    if (choice.dialog) { setReason(""); setUntil(""); setAction(choice); }
    else void run(choice);
  };
  if (!actions.length) return null;
  return <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {primary ? <div className="flex items-center gap-2"><Button size="sm" variant="outline" className="min-h-10" disabled={pending} onClick={()=>choose(actions[0])}>{actions[0].label}</Button>{actions.length>1&&<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10" disabled={pending} aria-label={`Другие действия: ${task.title}`}><MoreHorizontal/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{actions.slice(1).map(a=><DropdownMenuItem key={a.status} onSelect={()=>choose(a)}>{a.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}</div> : menu ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={pending} aria-label={`Действия: ${task.title}`} title="Действия задачи"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{actions.map(a => <DropdownMenuItem key={a.status} onSelect={() => choose(a)}>{a.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      : <div className="flex flex-wrap gap-2">{actions.map(a => <Button key={a.status} size="sm" variant="outline" disabled={pending} onClick={() => choose(a)}>{a.label}</Button>)}</div>}
    <Dialog open={!!action} onOpenChange={open => { if (!open && !pending) setAction(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{action?.label}</DialogTitle><DialogDescription>{task.title}</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor={`reason-${task.id}`}>{action?.dialog === "waiting" ? "Причина ожидания" : "Что доработать"}</Label><Textarea id={`reason-${task.id}`} value={reason} onChange={e => setReason(e.target.value)} required autoFocus /></div>
      {action?.dialog === "waiting" && <div className="space-y-2"><Label htmlFor={`until-${task.id}`}>Дата возобновления</Label><Input id={`until-${task.id}`} type="date" value={until} onChange={e => setUntil(e.target.value)} /></div>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setAction(null)}>Отмена</Button><Button disabled={pending || !reason.trim()} onClick={() => { if (action) void run(action); }}>Сохранить</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}