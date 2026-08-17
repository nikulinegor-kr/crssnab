import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (projectId: string) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [objectId, setObjectId] = useState<string>("none");
  const [manager, setManager] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: objects = [] } = useQuery({
    queryKey: ["objects-for-projects", currentOrgId],
    enabled: !!currentOrgId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Укажите название проекта", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("requests")
        .insert([
          {
            request_number: `PRJ-${new Date().getFullYear()}-${Date.now()}`,
            request_date: new Date().toISOString().split("T")[0],
            description: name.trim(),
            status: "Входящая заявка",
            priority: "Планово",
            applicant: manager.trim() || "—",
            executor: manager.trim() || null,
            object_id: objectId === "none" ? null : objectId,
            is_project: true,
            organization_id: currentOrgId,
            created_by: userData.user?.id ?? null,
          },
        ])
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["projects-tree"] });
      qc.invalidateQueries({ queryKey: ["project-options"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Проект создан", description: name.trim() });
      setName("");
      setManager("");
      setObjectId("none");
      onOpenChange(false);
      if (data?.id) onCreated?.(data.id);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
          <DialogDescription>
            Проект — родительская заявка-контейнер, в которую входят дочерние заявки.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Название проекта *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Материалы ремонта моста Тимптон — 1 очередь"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Объект</Label>
            <Select value={objectId} onValueChange={setObjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Не выбран" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не выбран</SelectItem>
                {objects.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Руководитель проекта</Label>
            <Input
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="ФИО"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Создание…" : "Создать проект"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
