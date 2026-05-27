import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { usePlannerStages, useUpsertPlannerStage, useDeletePlannerStage, type PlannerStage } from "@/hooks/usePlannerStages";
import { usePlannerTasks } from "@/hooks/usePlannerTasks";

const STATUS_LABEL: Record<string, string> = {
  planned: "Запланирован",
  active: "В работе",
  done: "Готов",
  blocked: "Заблокирован",
};

export default function PlannerStages() {
  const { currentOrgId } = useCurrentOrganization();
  const { data: stages = [] } = usePlannerStages();
  const { data: tasks = [] } = usePlannerTasks();
  const upsert = useUpsertPlannerStage();
  const del = useDeletePlannerStage();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<PlannerStage> | null>(null);

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
    enabled: !!currentOrgId,
  });

  const progress = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.stage_id) continue;
      map[t.stage_id] ??= { total: 0, done: 0 };
      map[t.stage_id].total++;
      if (t.status === "done") map[t.stage_id].done++;
    }
    return map;
  }, [tasks]);

  const objName = (id: string | null) => objects.find((o: any) => o.id === id)?.name ?? "—";

  const openNew = () => { setEdit({ name: "", status: "planned" }); setOpen(true); };
  const openEdit = (s: PlannerStage) => { setEdit(s); setOpen(true); };

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
            <Layers className="h-4 w-4" /> Этапы работ
          </h2>
          <p className="text-xs text-muted-foreground">Группируйте задачи по этапам внутри объектов</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Новый этап</Button>
      </div>

      {stages.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Ещё нет этапов. Создайте первый, чтобы планировать работы по объектам.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stages.map((s) => {
            const p = progress[s.id] ?? { total: 0, done: 0 };
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <Card key={s.id} className="p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{objName(s.object_id)}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => confirm("Удалить этап?") && del.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[s.status]}</Badge>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{p.done} / {p.total} задач</span>
                    <span className="font-numeric">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit?.id ? "Редактировать этап" : "Новый этап"}</DialogTitle></DialogHeader>
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
                <Label>Объект</Label>
                <Select value={edit?.object_id ?? "none"} onValueChange={(v) => setEdit((p) => ({ ...p, object_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {objects.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Статус</Label>
                <Select value={edit?.status ?? "planned"} onValueChange={(v) => setEdit((p) => ({ ...p, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Начало</Label>
                <Input type="date" value={edit?.start_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, start_date: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Дедлайн</Label>
                <Input type="date" value={edit?.due_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, due_date: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
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
