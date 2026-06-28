import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Trash2, Send, History, Lock, Repeat, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  PLANNER_COLUMNS,
  PRIORITY_META,
  type PlannerTask,
  type PlannerTaskPriority,
  type PlannerTaskStatus,
  type ChecklistItem,
  type PlannerAttachment,
  type PlannerRecurrence,
  usePlannerTasks,
  useCreatePlannerTask,
  useUpdatePlannerTask,
  useDeletePlannerTask,
} from "@/hooks/usePlannerTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { usePlannerTaskComments, useAddPlannerComment, usePlannerTaskActivity } from "@/hooks/usePlannerTaskComments";
import { usePlannerStages } from "@/hooks/usePlannerStages";
import { usePlannerTemplates } from "@/hooks/usePlannerTemplates";
import { usePlannerDependencies, useAddPlannerDependency, useRemovePlannerDependency } from "@/hooks/usePlannerDependencies";
import { PlannerAttachmentsField } from "./PlannerAttachmentsField";
import { VoiceInputButton } from "./VoiceInputButton";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: PlannerTask | null;
  defaultStatus?: PlannerTaskStatus;
  defaultDueDate?: string;
  defaultObjectId?: string | null;
  defaultRequestId?: string | null;
}

export function PlannerTaskDialog({ open, onOpenChange, task, defaultStatus, defaultDueDate, defaultObjectId, defaultRequestId }: Props) {
  const isEdit = !!task;
  const { currentOrgId } = useCurrentOrganization();
  const create = useCreatePlannerTask();
  const update = useUpdatePlannerTask();
  const del = useDeletePlannerTask();
  const { data: members = [] } = useOrgMembers();
  const { data: stages = [] } = usePlannerStages();
  const { data: templates = [] } = usePlannerTemplates();
  const { data: allTasks = [] } = usePlannerTasks();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<PlannerTaskStatus>(task?.status ?? defaultStatus ?? "backlog");
  const [priority, setPriority] = useState<PlannerTaskPriority>(task?.priority ?? "medium");
  const [objectId, setObjectId] = useState<string | null>(task?.object_id ?? defaultObjectId ?? null);
  const [stageId, setStageId] = useState<string | null>(task?.stage_id ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee_id ?? null);
  const [assigneeName, setAssigneeName] = useState<string>((task as any)?.assignee_name ?? "");
  const [startDate, setStartDate] = useState(task?.start_date?.slice(0, 10) ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) ?? defaultDueDate ?? "");
  const [dueTime, setDueTime] = useState<string>((task as any)?.due_time?.slice(0, 5) ?? "");
  const [equipmentId, setEquipmentId] = useState<string | null>(task?.equipment_id ?? null);
  const [requestId, setRequestId] = useState<string | null>(task?.request_id ?? defaultRequestId ?? null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [attachments, setAttachments] = useState<PlannerAttachment[]>(task?.attachments ?? []);
  const [isPrivate, setIsPrivate] = useState(task?.is_private ?? false);
  const [recurrence, setRecurrence] = useState<PlannerRecurrence | null>(task?.recurrence ?? null);
  const [estimatedHours, setEstimatedHours] = useState<string>(task?.estimated_hours?.toString() ?? "");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [tab, setTab] = useState("details");
  const [newComment, setNewComment] = useState("");
  const [templateId, setTemplateId] = useState<string>("");

  const filteredStages = stages.filter((s) => !objectId || s.object_id === objectId || !s.object_id);

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

  const { data: equipmentList = [] } = useQuery({
    queryKey: ["planner-equipment", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("equipment")
        .select("id, brand, model, plate_number, vin, current_object_id, responsible_name")
        .eq("organization_id", currentOrgId)
        .order("brand");
      return (data ?? []) as any[];
    },
    enabled: !!currentOrgId && open,
  });

  const equipmentLabel = (e: any) =>
    [e.brand, e.model].filter(Boolean).join(" ").trim() || e.plate_number || e.vin || "Техника";

  // Filtered equipment if object pre-selected
  const visibleEquipment = objectId && !equipmentId
    ? equipmentList.filter((e: any) => e.current_object_id === objectId)
    : equipmentList;

  // Auto-fill object when equipment selected
  const handleEquipmentChange = (val: string) => {
    const next = val === "__none__" ? null : val;
    setEquipmentId(next);
    if (next) {
      const eq = equipmentList.find((e: any) => e.id === next);
      if (eq?.current_object_id && !objectId) {
        setObjectId(eq.current_object_id);
      }
    }
  };

  const selectedEquipment = equipmentId ? equipmentList.find((e: any) => e.id === equipmentId) : null;

  const { data: requestsList = [] } = useQuery({
    queryKey: ["planner-requests-pick", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("requests")
        .select("id, request_number, description, status")
        .eq("organization_id", currentOrgId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
    enabled: !!currentOrgId && open,
  });

  const { data: comments = [] } = usePlannerTaskComments(isEdit ? task!.id : null);
  const { data: activity = [] } = usePlannerTaskActivity(isEdit ? task!.id : null);
  const { data: deps = [] } = usePlannerDependencies(isEdit ? task!.id : null);
  const addComment = useAddPlannerComment();
  const addDep = useAddPlannerDependency();
  const removeDep = useRemovePlannerDependency();
  const [depCandidate, setDepCandidate] = useState("");

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

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "none") return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!title) setTitle(tpl.name);
    if (tpl.description) setDescription(tpl.description);
    setPriority(tpl.priority);
    setChecklist((prev) => [
      ...prev,
      ...((tpl.checklist ?? []).map((i) => ({ id: crypto.randomUUID(), text: i.text, done: false }))),
    ]);
    if (tpl.estimated_hours != null) setEstimatedHours(String(tpl.estimated_hours));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      object_id: objectId,
      stage_id: stageId,
      request_id: requestId,
      assignee_id: null,
      assignee_name: assigneeName.trim() || null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      due_time: dueTime || null,
      equipment_id: equipmentId,
      checklist,
      attachments,
      is_private: isPrivate,
      recurrence,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
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
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? "Редактировать задачу" : "Новая задача"}
            {isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            {recurrence && <Repeat className="h-3.5 w-3.5 text-muted-foreground" />}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          {isEdit && (
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Детали</TabsTrigger>
              <TabsTrigger value="deps">Связи {deps.length > 0 && <span className="ml-1 text-xs opacity-70">({deps.length})</span>}</TabsTrigger>
              <TabsTrigger value="comments">
                Чат {comments.length > 0 && <span className="ml-1 text-xs opacity-70">({comments.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="activity">История</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="details" className="space-y-4 mt-4">
            {!isEdit && templates.length > 0 && (
              <div className="space-y-1.5">
                <Label>Шаблон</Label>
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Без шаблона" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без шаблона</SelectItem>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Название *</Label>
              <div className="flex gap-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" autoFocus />
                <VoiceInputButton onResult={(t) => setTitle((p) => (p ? p + " " : "") + t)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Описание</Label>
              <div className="flex gap-2">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Детали…" />
                <VoiceInputButton onResult={(t) => setDescription((p) => (p ? p + " " : "") + t)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Статус</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as PlannerTaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANNER_COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Приоритет</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as PlannerTaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as PlannerTaskPriority[]).map((p) =>
                      <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ответственный</Label>
                <Input
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  placeholder="ФИО"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Объект</Label>
                <Select value={objectId ?? "none"} onValueChange={(v) => { setObjectId(v === "none" ? null : v); setStageId(null); }}>
                  <SelectTrigger><SelectValue placeholder="Без объекта" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {objects.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-1.5">
                <Label>Начало</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Дата выполнения</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Время</Label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Техника</Label>
                <Select value={equipmentId ?? "__none__"} onValueChange={handleEquipmentChange}>
                  <SelectTrigger><SelectValue placeholder="Без техники" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {visibleEquipment.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {equipmentLabel(e)}
                        {e.plate_number ? ` · ${e.plate_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEquipment && (
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] space-y-0.5 mt-1">
                    <div className="font-medium">{equipmentLabel(selectedEquipment)}</div>
                    {selectedEquipment.plate_number && <div>Гос. №: {selectedEquipment.plate_number}</div>}
                    {selectedEquipment.vin && <div>VIN: {selectedEquipment.vin}</div>}
                    {selectedEquipment.current_object_id && (
                      <div>Объект: {objects.find((o: any) => o.id === selectedEquipment.current_object_id)?.name ?? "—"}</div>
                    )}
                    {selectedEquipment.responsible_name && <div>Ответственный: {selectedEquipment.responsible_name}</div>}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Связать с заявкой CRM</Label>
                <Select value={requestId ?? "none"} onValueChange={(v) => setRequestId(v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Без заявки" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {requestsList.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.description || `Заявка ${r.request_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Личная задача — статус заявки не меняется автоматически</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Личная задача</div>
                    <div className="text-[11px] text-muted-foreground">Видите только вы и ответственный</div>
                  </div>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> Повторять</Label>
                <Select value={recurrence?.freq ?? "none"}
                  onValueChange={(v) => setRecurrence(v === "none" ? null : { freq: v as any, interval: 1 })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не повторять</SelectItem>
                    <SelectItem value="daily">Ежедневно</SelectItem>
                    <SelectItem value="weekly">Еженедельно</SelectItem>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Чек-лист</Label>
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5">
                    <Checkbox checked={item.done}
                      onCheckedChange={(v) => setChecklist((p) => p.map((i) => i.id === item.id ? { ...i, done: !!v } : i))} />
                    <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setChecklist((p) => p.filter((i) => i.id !== item.id))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheck())}
                    placeholder="Новый пункт…" />
                  <Button type="button" variant="outline" onClick={addCheck}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Вложения</Label>
              <PlannerAttachmentsField value={attachments} onChange={setAttachments} />
            </div>
          </TabsContent>

          {isEdit && (
            <TabsContent value="deps" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Блокируется задачами</Label>
                <div className="space-y-1.5">
                  {deps.map((d) => {
                    const t = allTasks.find((x) => x.id === d.blocked_by_task_id);
                    return (
                      <div key={d.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5">
                        <Badge variant="secondary" className="text-[10px] shrink-0">{t?.status ?? "—"}</Badge>
                        <span className="flex-1 text-sm truncate">{t?.title ?? d.blocked_by_task_id}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDep.mutate(d.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {deps.length === 0 && <p className="text-xs text-muted-foreground">Нет зависимостей</p>}
                </div>
                <div className="flex gap-2">
                  <Select value={depCandidate} onValueChange={setDepCandidate}>
                    <SelectTrigger><SelectValue placeholder="Выберите задачу…" /></SelectTrigger>
                    <SelectContent>
                      {allTasks
                        .filter((t) => t.id !== task!.id && !deps.some((d) => d.blocked_by_task_id === t.id))
                        .slice(0, 100)
                        .map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" disabled={!depCandidate}
                    onClick={async () => { await addDep.mutateAsync({ taskId: task!.id, blockedById: depCandidate }); setDepCandidate(""); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}

          {isEdit && (
            <TabsContent value="comments" className="mt-4">
              <ScrollArea className="h-[320px] pr-2">
                <div className="space-y-3">
                  {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Ещё нет комментариев</p>}
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
                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Написать комментарий…" rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendComment(); }
                  }} />
                <VoiceInputButton onResult={(t) => setNewComment((p) => (p ? p + " " : "") + t)} />
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
                  {activity.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Нет событий</p>}
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
