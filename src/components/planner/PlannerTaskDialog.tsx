import { useState, useEffect, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, X, Trash2, History, Lock, Repeat, Link2, ChevronsUpDown, Check, Truck } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { usePlannerTaskActivity } from "@/hooks/usePlannerTaskComments";
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

const equipmentLabelLocal = (e: any) =>
  [e.brand, e.model].filter(Boolean).join(" ").trim() || e.plate_number || e.vin || "Техника";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PlannerTaskStatus>("backlog");
  const [priority, setPriority] = useState<PlannerTaskPriority>("medium");
  const [objectId, setObjectId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState<string>("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<PlannerAttachment[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [recurrence, setRecurrence] = useState<PlannerRecurrence | null>(null);
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [tab, setTab] = useState("details");
  const [templateId, setTemplateId] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // CRITICAL: reset state whenever dialog opens or task changes.
  // Fixes "fields cleared/reset when editing" bug caused by useState initializers only running once.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? defaultStatus ?? "backlog");
    setPriority(task?.priority ?? "medium");
    setObjectId(task?.object_id ?? defaultObjectId ?? null);
    setStageId(task?.stage_id ?? null);
    setAssigneeId(task?.assignee_id ?? null);
    setStartDate(task?.start_date?.slice(0, 10) ?? "");
    setDueDate(task?.due_date?.slice(0, 10) ?? defaultDueDate ?? "");
    setDueTime((task as any)?.due_time?.slice(0, 5) ?? "");
    const initialEq = task?.equipment_ids?.length
      ? task.equipment_ids
      : (task?.equipment_id ? [task.equipment_id] : []);
    setEquipmentIds(initialEq);
    setRequestId(task?.request_id ?? defaultRequestId ?? null);
    setChecklist(task?.checklist ?? []);
    setAttachments(task?.attachments ?? []);
    setIsPrivate(task?.is_private ?? false);
    setRecurrence(task?.recurrence ?? null);
    setEstimatedHours(task?.estimated_hours?.toString() ?? "");
    setErrors({});
    setTab("details");
    setTemplateId("");
  }, [open, task, defaultStatus, defaultDueDate, defaultObjectId, defaultRequestId]);

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

  const equipmentById = useMemo(() => new Map(equipmentList.map((e: any) => [e.id, e])), [equipmentList]);
  const selectedEquipment = equipmentIds.map((id) => equipmentById.get(id)).filter(Boolean);

  // Auto-fill object from first selected equipment
  const toggleEquipment = (id: string) => {
    setEquipmentIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      if (next.length === 1 && !objectId) {
        const eq = equipmentById.get(id);
        if (eq?.current_object_id) setObjectId(eq.current_object_id);
      }
      return next;
    });
  };

  const { data: requestsList = [] } = useQuery({
    queryKey: ["planner-requests-pick", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data } = await supabase
        .from("requests")
        .select("id, request_number, description, status, executor, contractor, object_id")
        .eq("organization_id", currentOrgId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentOrgId && open,
  });

  const objectsById = useMemo(() => new Map(objects.map((o: any) => [o.id, o])), [objects]);
  const selectedRequest = requestId ? (requestsList as any[]).find((r) => r.id === requestId) : null;

  const { data: activity = [] } = usePlannerTaskActivity(isEdit ? task!.id : null);
  const { data: deps = [] } = usePlannerDependencies(isEdit ? task!.id : null);
  const addDep = useAddPlannerDependency();
  const removeDep = useRemovePlannerDependency();
  const [depCandidate, setDepCandidate] = useState("");

  const memberById = (id: string | null) => members.find((m) => m.user_id === id);
  const memberLabel = (id: string | null) => {
    const m = memberById(id);
    return m?.full_name || m?.email || "—";
  };
  const selectedAssignee = assigneeId ? memberById(assigneeId) : null;

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

  const validate = (): { ok: boolean; missing: string[] } => {
    const miss: string[] = [];
    const errs: Record<string, boolean> = {};
    if (!title.trim()) { miss.push("Название"); errs.title = true; }
    if (!description.trim()) { miss.push("Описание"); errs.description = true; }
    if (!status) { miss.push("Статус"); errs.status = true; }
    if (!priority) { miss.push("Приоритет"); errs.priority = true; }
    if (!assigneeId) { miss.push("Ответственный"); errs.assigneeId = true; }
    if (!startDate) { miss.push("Дата начала"); errs.startDate = true; }
    if (!dueDate) { miss.push("Дата окончания"); errs.dueDate = true; }
    setErrors(errs);
    return { ok: miss.length === 0, missing: miss };
  };

  const handleSave = async () => {
    const v = validate();
    if (!v.ok) {
      toast.error("Заполните обязательные поля", { description: v.missing.join(", ") });
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      object_id: objectId,
      stage_id: stageId,
      request_id: requestId,
      assignee_id: assigneeId,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      due_time: dueTime || null,
      equipment_id: equipmentIds[0] ?? null,
      equipment_ids: equipmentIds,
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

  const errCls = (k: string) => errors[k] ? "border-destructive focus-visible:ring-destructive" : "";

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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Детали</TabsTrigger>
              <TabsTrigger value="deps">Связи {deps.length > 0 && <span className="ml-1 text-xs opacity-70">({deps.length})</span>}</TabsTrigger>
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
              <Label>Название <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" autoFocus className={errCls("title")} />
                <VoiceInputButton onResult={(t) => setTitle((p) => (p ? p + " " : "") + t)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Описание <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Детали…" className={errCls("description")} />
                <VoiceInputButton onResult={(t) => setDescription((p) => (p ? p + " " : "") + t)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Статус <span className="text-destructive">*</span></Label>
                <Select value={status} onValueChange={(v) => setStatus(v as PlannerTaskStatus)}>
                  <SelectTrigger className={errCls("status")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANNER_COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Приоритет <span className="text-destructive">*</span></Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as PlannerTaskPriority)}>
                  <SelectTrigger className={errCls("priority")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as PlannerTaskPriority[]).map((p) =>
                      <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ответственный <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", errCls("assigneeId"))}>
                      <span className="truncate">
                        {selectedAssignee ? (selectedAssignee.full_name || selectedAssignee.email) : "Выберите…"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Поиск сотрудника…" />
                      <CommandList>
                        <CommandEmpty>Не найдено</CommandEmpty>
                        <CommandGroup>
                          {members.map((m) => (
                            <CommandItem
                              key={m.user_id}
                              value={`${m.full_name ?? ""} ${m.email ?? ""}`}
                              onSelect={() => setAssigneeId(m.user_id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", assigneeId === m.user_id ? "opacity-100" : "opacity-0")} />
                              <Avatar className="h-6 w-6 mr-2"><AvatarFallback className="text-[10px]">{initialsOf(m)}</AvatarFallback></Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{m.full_name || m.email}</div>
                                {m.position && <div className="text-[10px] text-muted-foreground truncate">{m.position}</div>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                <Label>Дата начала <span className="text-destructive">*</span></Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={errCls("startDate")} />
              </div>

              <div className="space-y-1.5">
                <Label>Дата окончания <span className="text-destructive">*</span></Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={errCls("dueDate")} />
              </div>

              <div className="space-y-1.5">
                <Label>Время</Label>
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Техника (можно несколько)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal min-h-10 h-auto py-2">
                      <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
                        {selectedEquipment.length === 0 && <span className="text-muted-foreground text-sm">Без техники</span>}
                        {selectedEquipment.map((e: any) => (
                          <Badge key={e.id} variant="secondary" className="gap-1 max-w-full">
                            <Truck className="h-3 w-3" />
                            <span className="truncate">
                              {equipmentLabelLocal(e)}{e.plate_number ? ` · ${e.plate_number}` : ""}
                            </span>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); toggleEquipment(e.id); }}
                              className="hover:text-destructive"
                              aria-label="Убрать"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Марка, модель, гос.№, инвентарный, VIN…" />
                      <CommandList className="max-h-72">
                        <CommandEmpty>Техника не найдена</CommandEmpty>
                        <CommandGroup>
                          {equipmentList.map((e: any) => {
                            const hay = [e.brand, e.model, e.plate_number, e.vin, e.responsible_name]
                              .filter(Boolean).join(" ");
                            return (
                              <CommandItem
                                key={e.id}
                                value={hay}
                                onSelect={() => toggleEquipment(e.id)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", equipmentIds.includes(e.id) ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {equipmentLabelLocal(e)}
                                    {e.plate_number && <span className="text-muted-foreground"> · {e.plate_number}</span>}
                                  </div>
                                  {(e.inventory_number || e.responsible_name) && (
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {e.inventory_number && `Инв. ${e.inventory_number}`}
                                      {e.inventory_number && e.responsible_name && " · "}
                                      {e.responsible_name}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Связать с заявкой CRM</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedRequest ? (selectedRequest.description || "Без названия") : "Без заявки"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command
                      filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
                    >
                      <CommandInput placeholder="Название, объект, техника, исполнитель, поставщик…" />
                      <CommandList className="max-h-80">
                        <CommandEmpty>Заявка не найдена</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="__none__" onSelect={() => setRequestId(null)}>
                            <Check className={cn("mr-2 h-4 w-4", !requestId ? "opacity-100" : "opacity-0")} />
                            <span className="text-muted-foreground">— Без заявки —</span>
                          </CommandItem>
                          {(requestsList as any[]).map((r) => {
                            const objName = r.object_id ? (objectsById.get(r.object_id) as any)?.name : null;
                            const hay = [r.description, objName, r.executor, r.contractor].filter(Boolean).join(" ");
                            return (
                              <CommandItem key={r.id} value={hay} onSelect={() => setRequestId(r.id)}>
                                <Check className={cn("mr-2 h-4 w-4", requestId === r.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{r.description || "Без названия"}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {[objName, r.executor, r.contractor].filter(Boolean).join(" · ") || r.status}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {isEdit ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
