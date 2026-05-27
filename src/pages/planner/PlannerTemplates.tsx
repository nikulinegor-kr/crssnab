import { useState } from "react";
import { Plus, Pencil, Trash2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_META, type PlannerTaskPriority, type ChecklistItem } from "@/hooks/usePlannerTasks";
import { usePlannerTemplates, useUpsertPlannerTemplate, useDeletePlannerTemplate, type PlannerTaskTemplate } from "@/hooks/usePlannerTemplates";

export default function PlannerTemplates() {
  const { data: templates = [] } = usePlannerTemplates();
  const upsert = useUpsertPlannerTemplate();
  const del = useDeletePlannerTemplate();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<PlannerTaskTemplate> | null>(null);
  const [newCheck, setNewCheck] = useState("");

  const openNew = () => { setEdit({ name: "", priority: "medium", checklist: [] }); setOpen(true); };
  const openEdit = (t: PlannerTaskTemplate) => { setEdit({ ...t, checklist: t.checklist ?? [] }); setOpen(true); };

  const addCheck = () => {
    if (!newCheck.trim()) return;
    setEdit((p) => ({ ...p, checklist: [...(p?.checklist ?? []), { id: crypto.randomUUID(), text: newCheck.trim(), done: false }] }));
    setNewCheck("");
  };

  const save = async () => {
    if (!edit?.name?.trim()) return;
    await upsert.mutateAsync(edit as any);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Шаблоны задач
          </h2>
          <p className="text-xs text-muted-foreground">Типовые работы с готовыми чек-листами</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Новый шаблон</Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Шаблоны не созданы. Создайте первый, чтобы быстро добавлять типовые задачи.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.name}</span>
                    <Badge className={PRIORITY_META[t.priority].className + " text-[10px]"}>
                      {PRIORITY_META[t.priority].label}
                    </Badge>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {t.checklist?.length ?? 0} пунктов в чек-листе
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => confirm("Удалить шаблон?") && del.mutate(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Редактировать шаблон" : "Новый шаблон"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Описание</Label>
              <Textarea rows={2} value={edit?.description ?? ""} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Приоритет</Label>
                <Select value={edit?.priority ?? "medium"} onValueChange={(v) => setEdit((p) => ({ ...p, priority: v as PlannerTaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_META) as PlannerTaskPriority[]).map((k) =>
                      <SelectItem key={k} value={k}>{PRIORITY_META[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Оценка часов</Label>
                <Input type="number" min={0} step="0.5" value={edit?.estimated_hours ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, estimated_hours: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Чек-лист</Label>
              <div className="space-y-1.5">
                {(edit?.checklist ?? []).map((item: ChecklistItem) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5">
                    <span className="flex-1 text-sm">{item.text}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEdit((p) => ({ ...p, checklist: (p?.checklist ?? []).filter((i) => i.id !== item.id) }))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newCheck} onChange={(e) => setNewCheck(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheck())}
                    placeholder="Новый пункт…" />
                  <Button type="button" variant="outline" onClick={addCheck}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={save} disabled={!edit?.name?.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
