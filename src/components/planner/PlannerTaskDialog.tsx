import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Trash2 } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: PlannerTask | null;
  defaultStatus?: PlannerTaskStatus;
}

export function PlannerTaskDialog({ open, onOpenChange, task, defaultStatus }: Props) {
  const isEdit = !!task;
  const { currentOrgId } = useCurrentOrganization();
  const create = useCreatePlannerTask();
  const update = useUpdatePlannerTask();
  const del = useDeletePlannerTask();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<PlannerTaskStatus>(task?.status ?? defaultStatus ?? "backlog");
  const [priority, setPriority] = useState<PlannerTaskPriority>(task?.priority ?? "medium");
  const [objectId, setObjectId] = useState<string | null>(task?.object_id ?? null);
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [newCheckItem, setNewCheckItem] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать задачу" : "Новая задача"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
        </div>

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
