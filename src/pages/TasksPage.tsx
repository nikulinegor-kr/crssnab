import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/hooks/useNotifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  task_number: string | null;
  created_at: string;
  organization_id: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

const statuses = ["В работе", "Выполнено", "Просрочено", "На паузе"];
const priorities = ["Низкий", "Средний", "Высокий"];

export default function TasksPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "В работе",
    priority: "Средний",
    due_date: "",
    task_number: "",
    assignee_id: "",
  });

  // Получаем задачи
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
    enabled: !!currentOrgId,
  });

  // Получаем профили пользователей организации
  const { data: profiles } = useQuery({
    queryKey: ["org-users", currentOrgId],
    queryFn: async () => {
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", currentOrgId);

      if (userOrgsError) throw userOrgsError;
      
      const userIds = userOrgs?.map(uo => uo.user_id) || [];
      
      if (userIds.length === 0) return [];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return profilesData as Profile[];
    },
    enabled: !!currentOrgId,
  });

  // Создание/обновление задачи
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      
      if (editingTask) {
        const { error } = await supabase
          .from("tasks")
          .update(data)
          .eq("id", editingTask.id);
        if (error) throw error;

        // Если изменился ответственный, отправляем уведомление
        if (data.assignee_id && data.assignee_id !== editingTask.assignee_id) {
          await createNotification({
            userId: data.assignee_id,
            organizationId: currentOrgId!,
            type: "task_assigned",
            title: "Вы назначены ответственным",
            message: `Вы назначены ответственным за задачу: ${data.title}`,
            link: `/tasks`,
          });
        }
      } else {
        const taskNumber = data.task_number || `#T-${Date.now().toString().slice(-4)}`;
        const { error: taskError } = await supabase
          .from("tasks")
          .insert([{ 
            ...data, 
            task_number: taskNumber,
            organization_id: currentOrgId, 
            created_by: user.user?.id 
          }]);
        if (taskError) throw taskError;

        // Если есть ответственный, отправляем уведомление
        if (data.assignee_id) {
          await createNotification({
            userId: data.assignee_id,
            organizationId: currentOrgId!,
            type: "task_assigned",
            title: "Вы назначены ответственным",
            message: `Вы назначены ответственным за задачу: ${data.title}`,
            link: `/tasks`,
          });
        }

        // Если есть срок выполнения, создаем событие в календаре
        if (data.due_date) {
          const { error: calendarError } = await supabase
            .from("calendar_events")
            .insert([{
              title: `Задача: ${data.title}`,
              description: data.description,
              start_date: new Date(data.due_date).toISOString(),
              all_day: true,
              organization_id: currentOrgId,
              created_by: user.user?.id,
              assignee_id: data.assignee_id || null,
              event_type: "task"
            }]);
          if (calendarError) console.error("Ошибка создания события:", calendarError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: editingTask ? "Задача обновлена" : "Задача создана",
        description: editingTask 
          ? "Задача успешно обновлена"
          : "Новая задача успешно создана",
      });
      handleCloseDialog();
    },
  });

  // Удаление задачи
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Задача удалена",
        description: "Задача успешно удалена",
      });
    },
  });

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        due_date: task.due_date || "",
        task_number: task.task_number || "",
        assignee_id: task.assignee_id || "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      status: "В работе",
      priority: "Средний",
      due_date: "",
      task_number: "",
      assignee_id: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const filteredTasks = tasks?.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.task_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Выполнено": return "bg-success/20 text-success";
      case "В работе": return "bg-info/20 text-info";
      case "Просрочено": return "bg-destructive/20 text-destructive";
      case "На паузе": return "bg-warning/20 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Высокий": return "text-destructive";
      case "Средний": return "text-warning";
      case "Низкий": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return "—";
    const profile = profiles?.find(p => p.id === assigneeId);
    return profile?.full_name || profile?.email || "—";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Заголовок */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Задачи</h1>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Создать задачу
            </Button>
          </div>

          {/* Поиск и фильтры */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по задачам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Фильтры
            </Button>
          </div>
        </div>

        {/* Таблица задач */}
        <Card className="bg-card border-border/40">
          <CardHeader className="border-b border-border/40">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground uppercase">
              <div className="col-span-4">Название задачи</div>
              <div className="col-span-2">Ответственный</div>
              <div className="col-span-2">Статус</div>
              <div className="col-span-2">Приоритет</div>
              <div className="col-span-1">Срок</div>
              <div className="col-span-1 text-right">Действия</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Загрузка...
              </div>
            ) : filteredTasks && filteredTasks.length > 0 ? (
              <div className="divide-y divide-border/40">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/30 transition-colors items-center"
                  >
                    <div className="col-span-4">
                      <div className="font-medium text-foreground">{task.title}</div>
                      <div className="text-xs text-muted-foreground">{task.task_number}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getAssigneeName(task.assignee_id).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          {getAssigneeName(task.assignee_id)}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="col-span-1 text-sm text-muted-foreground">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString("ru-RU") : "—"}
                    </div>
                    <div className="col-span-1 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(task)}>
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(task.id)}
                            className="text-destructive"
                          >
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? "Задачи не найдены" : "Нет задач"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Диалог создания/редактирования */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTask ? "Редактировать задачу" : "Новая задача"}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о задаче
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Статус *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Приоритет *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Срок выполнения</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Ответственный</Label>
                <Select
                  value={formData.assignee_id}
                  onValueChange={(value) => setFormData({ ...formData, assignee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите ответственного" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Не назначен</SelectItem>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Отменить
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Сохранение..." : editingTask ? "Обновить" : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
