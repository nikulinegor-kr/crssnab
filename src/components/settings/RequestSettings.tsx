import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, AlertCircle, Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RequestSettingsProps {
  organizationId: string;
}

interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface Priority {
  id: string;
  name: string;
  color: string;
  order: number;
}

export const RequestSettings = ({ organizationId }: RequestSettingsProps) => {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#6366f1");
  const [newPriorityName, setNewPriorityName] = useState("");
  const [newPriorityColor, setNewPriorityColor] = useState("#6366f1");

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      const [statusesRes, prioritiesRes] = await Promise.all([
        supabase
          .from("request_statuses")
          .select("*")
          .eq("organization_id", organizationId)
          .order("order"),
        supabase
          .from("request_priorities")
          .select("*")
          .eq("organization_id", organizationId)
          .order("order"),
      ]);

      if (statusesRes.error) throw statusesRes.error;
      if (prioritiesRes.error) throw prioritiesRes.error;

      setStatuses(statusesRes.data || []);
      setPriorities(prioritiesRes.data || []);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addStatus = async () => {
    if (!newStatusName.trim()) return;

    try {
      const { error } = await supabase.from("request_statuses").insert({
        organization_id: organizationId,
        name: newStatusName,
        color: newStatusColor,
        order: statuses.length,
      });

      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "create",
        _entity_type: "request_status",
        _new_values: { name: newStatusName, color: newStatusColor },
      });

      toast({
        title: "Успешно",
        description: "Статус добавлен",
      });

      setNewStatusName("");
      setNewStatusColor("#6366f1");
      setIsAddingStatus(false);
      loadSettings();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addPriority = async () => {
    if (!newPriorityName.trim()) return;

    try {
      const { error } = await supabase.from("request_priorities").insert({
        organization_id: organizationId,
        name: newPriorityName,
        color: newPriorityColor,
        order: priorities.length,
      });

      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "create",
        _entity_type: "request_priority",
        _new_values: { name: newPriorityName, color: newPriorityColor },
      });

      toast({
        title: "Успешно",
        description: "Приоритет добавлен",
      });

      setNewPriorityName("");
      setNewPriorityColor("#6366f1");
      setIsAddingPriority(false);
      loadSettings();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteStatus = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("request_statuses").delete().eq("id", id);

      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "delete",
        _entity_type: "request_status",
        _entity_id: id,
        _old_values: { name },
      });

      toast({
        title: "Успешно",
        description: "Статус удален",
      });

      loadSettings();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePriority = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("request_priorities").delete().eq("id", id);

      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "delete",
        _entity_type: "request_priority",
        _entity_id: id,
        _old_values: { name },
      });

      toast({
        title: "Успешно",
        description: "Приоритет удален",
      });

      loadSettings();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Статусы заявок</CardTitle>
            </div>
            <Dialog open={isAddingStatus} onOpenChange={setIsAddingStatus}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить статус
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый статус</DialogTitle>
                  <DialogDescription>Добавьте новый статус для заявок</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status-name">Название</Label>
                    <Input
                      id="status-name"
                      value={newStatusName}
                      onChange={(e) => setNewStatusName(e.target.value)}
                      placeholder="Например: В работе"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status-color">Цвет</Label>
                    <div className="flex gap-2">
                      <Input
                        id="status-color"
                        type="color"
                        value={newStatusColor}
                        onChange={(e) => setNewStatusColor(e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={newStatusColor}
                        onChange={(e) => setNewStatusColor(e.target.value)}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingStatus(false)}>
                    Отмена
                  </Button>
                  <Button onClick={addStatus}>Добавить</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>Управление статусами заявок в системе</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Badge style={{ backgroundColor: status.color }}>{status.name}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteStatus(status.id, status.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {statuses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет добавленных статусов
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <CardTitle>Приоритеты заявок</CardTitle>
            </div>
            <Dialog open={isAddingPriority} onOpenChange={setIsAddingPriority}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить приоритет
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый приоритет</DialogTitle>
                  <DialogDescription>Добавьте новый приоритет для заявок</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="priority-name">Название</Label>
                    <Input
                      id="priority-name"
                      value={newPriorityName}
                      onChange={(e) => setNewPriorityName(e.target.value)}
                      placeholder="Например: Срочно"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority-color">Цвет</Label>
                    <div className="flex gap-2">
                      <Input
                        id="priority-color"
                        type="color"
                        value={newPriorityColor}
                        onChange={(e) => setNewPriorityColor(e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={newPriorityColor}
                        onChange={(e) => setNewPriorityColor(e.target.value)}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingPriority(false)}>
                    Отмена
                  </Button>
                  <Button onClick={addPriority}>Добавить</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>Управление приоритетами заявок в системе</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {priorities.map((priority) => (
              <div
                key={priority.id}
                className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Badge style={{ backgroundColor: priority.color }}>{priority.name}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePriority(priority.id, priority.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {priorities.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет добавленных приоритетов
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
