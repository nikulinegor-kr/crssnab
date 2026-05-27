import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X, Trash2, Send, History } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  PLANNER_COLUMNS,
  PRIORITY_META,
  type PlannerTask,
  type PlannerTaskPriority,
  type PlannerTaskStatus,
  type ChecklistItem,
  useCreatePlannerTask,
  useUpdatePlannerTask,
  useDeletePlannerTask,
} from "@/hooks/usePlannerTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { usePlannerTaskComments, useAddPlannerComment, usePlannerTaskActivity } from "@/hooks/usePlannerTaskComments";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: PlannerTask | null;
  defaultStatus?: PlannerTaskStatus;
  defaultDueDate?: string;
}

export function PlannerTaskDialog({ open, onOpenChange, task, defaultStatus, defaultDueDate }: Props) {
  const isEdit = !!task;
  const { currentOrgId } = useCurrentOrganization();
  const create = useCreatePlannerTask();
  const update = useUpdatePlannerTask();
  const del = useDeletePlannerTask();
  const { data: members = [] } = useOrgMembers();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<PlannerTaskStatus>(task?.status ?? defaultStatus ?? "backlog");
  const [priority, setPriority] = useState<PlannerTaskPriority>(task?.priority ?? "medium");
  const [objectId, setObjectId] = useState<string | null>(task?.object_id ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee_id ?? null);
  const [startDate, setStartDate] = useState(task?.start_date?.slice(0, 10) ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) ?? defaultDueDate ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [tab, setTab] = useState("details");
  const [newComment, setNewComment] = useState("");

  const { data: objects = [] } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId)
        .order("name");
      return data ?? [];
    },
    enabled: !!currentOrgId && open,
  });

  const { data: comments = [] } = usePlannerTaskComments(isEdit ? task!.id : null);
  const { data: activity = [] } = usePlannerTaskActivity(isEdit ? task!.id : null);
  const addComment = useAddPlannerComment();

  const memberById = (id: string | null) => members.find((m) => m.user_id === id);
  const memberLabel = (id: string | null) => {
    const m = memberById(id);
    return m?.full_name || m?.email || "—";
  };

  const addCheck = () => {
    if (!newCheckItem.trim()) return;
    setChecklist((p) => [...p, { id: crypto.randomUUID(), text: newCheckItem.trim(), done: false }]);
    setNewCheckItem("");
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      object_id: objectId,
      assignee_id: assigneeId,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      checklist,
    };
    if (isEdit && task) {
      await update.mutateAsync({ id: task.id, patch: payload as any });
    } else {
      await create.mutateAsync(payload as any);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm("Удалить задачу?")) return;
    await del.mutateAsync(task.id);
    onOpenChange(false);
  };

  const handleSendComment = async () => {
    if (!task || !newComment.trim()) return;
    await addComment.mutateAsync({ taskId: task.id, content: newComment.trim() });
    setNewComment("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать задачу" : "Новая задача"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          {isEdit && (
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Детали</TabsTrigger>
              <TabsTrigger value="comments">
                Комментарии {comments.length > 0 && <span className="ml-1 text-xs opacity-70">({comments.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="activity">История</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="details" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Детали…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PlannerTaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANNER_COLUMNS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as PlannerTaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as PlannerTaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Ответственный</Label>
              <Select value={assigneeId ?? "none"} onValueChange={(v) => setAssigneeId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Объект</Label>
              <Select value={objectId ?? "none"} onValueChange={(v) => setObjectId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Без объекта" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {objects.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Начало</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Дедлайн</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Чек-лист</Label>
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(v) =>
                      setChecklist((p) => p.map((i) => (i.id === item.id ? { ...i, done: !!v } : i)))
                    }
                  />
                  <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setChecklist((p) => p.filter((i) => i.id !== item.id))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheck())}
                  placeholder="Новый пункт…"
                />
                <Button type="button" variant="outline" onClick={addCheck}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          </TabsContent>

          {isEdit && (
            <TabsContent value="comments" className="mt-4">
              <ScrollArea className="h-[320px] pr-2">
                <div className="space-y-3">
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Ещё нет комментариев</p>
                  )}
                  {comments.map((c) => {
                    const m = memberById(c.user_id);
                    return (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">{initialsOf(m ?? {})}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-xs font-medium">{memberLabel(c.user_id)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.created_at), "d MMM, HH:mm", { locale: ru })}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Написать комментарий…"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                />
                <Button onClick={handleSendComment} disabled={!newComment.trim() || addComment.isPending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          )}

          {isEdit && (
            <TabsContent value="activity" className="mt-4">
              <ScrollArea className="h-[360px] pr-2">
                <div className="space-y-2">
                  {activity.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Нет событий</p>
                  )}
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-xs">
                      <History className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <div className="text-foreground">{a.description || `${a.action}${a.field_name ? ` · ${a.field_name}` : ""}`}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {memberLabel(a.user_id)} · {format(new Date(a.created_at), "d MMM, HH:mm", { locale: ru })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="flex sm:justify-between gap-2">
          {isEdit ? (
            <Button variant="ghost" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Удалить
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!title.trim() || create.isPending || update.isPending}>
              {isEdit ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
