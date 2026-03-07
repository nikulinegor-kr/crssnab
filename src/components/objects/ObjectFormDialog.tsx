import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUSES = ["Активный", "Приостановлен", "Завершён"];

interface ObjectFormData {
  name: string;
  address: string;
  responsible_user_id: string;
  contract_number: string;
  project_start_date: string;
  project_end_date: string;
  status: string;
  comment: string;
}

interface ObjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ObjectFormData) => void;
  isPending?: boolean;
  initialData?: Partial<ObjectFormData>;
  title?: string;
  currentOrgId: string | null;
}

export const ObjectFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
  title = "Новый объект",
  currentOrgId,
}: ObjectFormDialogProps) => {
  const [form, setForm] = useState<ObjectFormData>({
    name: "",
    address: "",
    responsible_user_id: "",
    contract_number: "",
    project_start_date: "",
    project_end_date: "",
    status: "Активный",
    comment: "",
  });

  useEffect(() => {
    if (open && initialData) {
      setForm({
        name: initialData.name || "",
        address: initialData.address || "",
        responsible_user_id: initialData.responsible_user_id || "",
        contract_number: initialData.contract_number || "",
        project_start_date: initialData.project_start_date || "",
        project_end_date: initialData.project_end_date || "",
        status: initialData.status || "Активный",
        comment: initialData.comment || "",
      });
    } else if (open) {
      setForm({
        name: "",
        address: "",
        responsible_user_id: "",
        contract_number: "",
        project_start_date: "",
        project_end_date: "",
        status: "Активный",
        comment: "",
      });
    }
  }, [open, initialData]);

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("user_id, profiles(full_name, email)")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && open,
  });

  const { data: applicants = [] } = useQuery({
    queryKey: ["request-participants-applicants", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_participants")
        .select("id, name")
        .eq("organization_id", currentOrgId!)
        .eq("participant_type", "applicant")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Название объекта *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Производственная база"
            />
          </div>
          <div>
            <Label>Адрес объекта</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="г. Москва, ул. Примерная, д. 1"
            />
          </div>
          <div>
            <Label>Ответственный</Label>
            <Select
              value={form.responsible_user_id || "__none__"}
              onValueChange={(val) => setForm({ ...form, responsible_user_id: val === "__none__" ? "" : val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите ответственного" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Не выбран —</SelectItem>
                {orgMembers.length > 0 && (
                  <SelectItem value="__group_members__" disabled className="text-xs font-semibold text-muted-foreground">
                    Сотрудники
                  </SelectItem>
                )}
                {orgMembers.map((m: any) => (
                  <SelectItem key={`user-${m.user_id}`} value={m.user_id}>
                    {m.profiles?.full_name || m.profiles?.email || m.user_id}
                  </SelectItem>
                ))}
                {applicants.length > 0 && (
                  <SelectItem value="__group_applicants__" disabled className="text-xs font-semibold text-muted-foreground">
                    Заявители
                  </SelectItem>
                )}
                {applicants.map((a: any) => (
                  <SelectItem key={`part-${a.id}`} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Номер контракта</Label>
            <Input
              value={form.contract_number}
              onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
              placeholder="КТ-2026-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Дата начала проекта</Label>
              <Input
                type="date"
                value={form.project_start_date}
                onChange={(e) => setForm({ ...form, project_start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Дата окончания проекта</Label>
              <Input
                type="date"
                value={form.project_end_date}
                onChange={(e) => setForm({ ...form, project_end_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Статус объекта</Label>
            <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Комментарий</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || isPending}
          >
            {initialData ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
