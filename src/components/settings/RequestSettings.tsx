import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, AlertCircle, Plus, Trash2, GripVertical, Loader2, ArrowUp, ArrowDown } from "lucide-react";
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
  const [draggingStatusId, setDraggingStatusId] = useState<string | null>(null);
  const [draggingPriorityId, setDraggingPriorityId] = useState<string | null>(null);

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

  const moveStatus = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= statuses.length) return;

    const newStatuses = [...statuses];
    const temp = newStatuses[index];
    newStatuses[index] = newStatuses[newIndex];
    newStatuses[newIndex] = temp;

    // Update order values
    const updates = newStatuses.map((s, i) => ({
      id: s.id,
      order: i,
    }));

    setStatuses(newStatuses.map((s, i) => ({ ...s, order: i })));

    try {
      for (const update of updates) {
        await supabase
          .from("request_statuses")
          .update({ order: update.order })
          .eq("id", update.id);
      }
      toast({
        title: "Порядок сохранён",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
      loadSettings();
    }
  };

  const movePriority = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= priorities.length) return;

    const newPriorities = [...priorities];
    const temp = newPriorities[index];
    newPriorities[index] = newPriorities[newIndex];
    newPriorities[newIndex] = temp;

    const updates = newPriorities.map((p, i) => ({
      id: p.id,
      order: i,
    }));

    setPriorities(newPriorities.map((p, i) => ({ ...p, order: i })));

    try {
      for (const update of updates) {
        await supabase
          .from("request_priorities")
          .update({ order: update.order })
          .eq("id", update.id);
      }
      toast({
        title: "Порядок сохранён",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
      loadSettings();
    }
  };

  const handleStatusDragStart = (e: React.DragEvent, id: string) => {
    setDraggingStatusId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleStatusDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingStatusId || draggingStatusId === targetId) return;

    const dragIndex = statuses.findIndex((s) => s.id === draggingStatusId);
    const targetIndex = statuses.findIndex((s) => s.id === targetId);

    if (dragIndex === -1 || targetIndex === -1) return;

    const newStatuses = [...statuses];
    const [dragged] = newStatuses.splice(dragIndex, 1);
    newStatuses.splice(targetIndex, 0, dragged);

    setStatuses(newStatuses.map((s, i) => ({ ...s, order: i })));
  };

  const handleStatusDragEnd = async () => {
    if (!draggingStatusId) return;

    try {
      for (let i = 0; i < statuses.length; i++) {
        await supabase
          .from("request_statuses")
          .update({ order: i })
          .eq("id", statuses[i].id);
      }
      toast({
        title: "Порядок сохранён",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
      loadSettings();
    }

    setDraggingStatusId(null);
  };

  const handlePriorityDragStart = (e: React.DragEvent, id: string) => {
    setDraggingPriorityId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePriorityDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingPriorityId || draggingPriorityId === targetId) return;

    const dragIndex = priorities.findIndex((p) => p.id === draggingPriorityId);
    const targetIndex = priorities.findIndex((p) => p.id === targetId);

    if (dragIndex === -1 || targetIndex === -1) return;

    const newPriorities = [...priorities];
    const [dragged] = newPriorities.splice(dragIndex, 1);
    newPriorities.splice(targetIndex, 0, dragged);

    setPriorities(newPriorities.map((p, i) => ({ ...p, order: i })));
  };

  const handlePriorityDragEnd = async () => {
    if (!draggingPriorityId) return;

    try {
      for (let i = 0; i < priorities.length; i++) {
        await supabase
          .from("request_priorities")
          .update({ order: i })
          .eq("id", priorities[i].id);
      }
      toast({
        title: "Порядок сохранён",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
      loadSettings();
    }

    setDraggingPriorityId(null);
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
          <CardDescription>
            Управление статусами заявок. Перетаскивайте или используйте стрелки для изменения порядка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statuses.map((status, index) => (
              <div
                key={status.id}
                draggable
                onDragStart={(e) => handleStatusDragStart(e, status.id)}
                onDragOver={(e) => handleStatusDragOver(e, status.id)}
                onDragEnd={handleStatusDragEnd}
                className={`flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50 transition-all ${
                  draggingStatusId === status.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  <Badge style={{ backgroundColor: status.color }}>{status.name}</Badge>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStatus(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveStatus(index, "down")}
                    disabled={index === statuses.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteStatus(status.id, status.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
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
          <CardDescription>
            Управление приоритетами заявок. Перетаскивайте или используйте стрелки для изменения порядка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {priorities.map((priority, index) => (
              <div
                key={priority.id}
                draggable
                onDragStart={(e) => handlePriorityDragStart(e, priority.id)}
                onDragOver={(e) => handlePriorityDragOver(e, priority.id)}
                onDragEnd={handlePriorityDragEnd}
                className={`flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50 transition-all ${
                  draggingPriorityId === priority.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  <Badge style={{ backgroundColor: priority.color }}>{priority.name}</Badge>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePriority(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePriority(index, "down")}
                    disabled={index === priorities.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePriority(priority.id, priority.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
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
