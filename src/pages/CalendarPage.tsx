import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  color: string | null;
  event_type: string | null;
  organization_id: string;
  assignee_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function CalendarPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<"month" | "week" | "day">("month");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    start_time: "09:00",
    all_day: false,
    assignee_id: "",
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

  // Получаем события
  const { data: events } = useQuery({
    queryKey: ["calendar-events", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!currentOrgId,
  });

  // Создание/редактирование события
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) throw new Error("User not authenticated");
      
      const startDateTime = data.all_day 
        ? new Date(data.start_date).toISOString()
        : new Date(`${data.start_date}T${data.start_time}`).toISOString();

      if (editingEvent) {
        // Редактирование существующего события
        const { error } = await supabase
          .from("calendar_events")
          .update({ 
            title: data.title,
            description: data.description,
            start_date: startDateTime,
            all_day: data.all_day,
            assignee_id: data.assignee_id || null
          })
          .eq("id", editingEvent.id);
        if (error) throw error;
      } else {
        // Создание нового события
        const { error } = await supabase
          .from("calendar_events")
          .insert([{ 
            title: data.title,
            description: data.description,
            start_date: startDateTime,
            all_day: data.all_day,
            organization_id: currentOrgId,
            created_by: user.id,
            assignee_id: data.assignee_id || null
          }]);
        if (error) throw error;
      }

      // Если есть ответственный, отправляем уведомление
      if (data.assignee_id && !editingEvent) {
        await createNotification({
          userId: data.assignee_id,
          organizationId: currentOrgId!,
          type: "event_assigned",
          title: "Вы назначены ответственным",
          message: `Вы назначены ответственным за событие: ${data.title}`,
          link: `/calendar`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: editingEvent ? "Событие обновлено" : "Событие создано",
        description: editingEvent 
          ? "Событие успешно обновлено"
          : "Новое событие успешно добавлено в календарь",
      });
      handleCloseDialog();
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { locale: ru });
  const endDate = endOfWeek(monthEnd, { locale: ru });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDay = (day: Date) => {
    return events?.filter(event => {
      const eventDate = new Date(event.start_date);
      return isSameDay(eventDate, day);
    }) || [];
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleOpenDialog = (date?: Date, event?: CalendarEvent) => {
    if (event) {
      setEditingEvent(event);
      const eventDate = new Date(event.start_date);
      setFormData({
        title: event.title,
        description: event.description || "",
        start_date: format(eventDate, "yyyy-MM-dd"),
        start_time: format(eventDate, "HH:mm"),
        all_day: event.all_day,
        assignee_id: event.assignee_id || "",
      });
    } else if (date) {
      setSelectedDate(date);
      setFormData({
        ...formData,
        start_date: format(date, "yyyy-MM-dd"),
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedDate(null);
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      start_date: "",
      start_time: "09:00",
      all_day: false,
      assignee_id: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return null;
    const profile = profiles?.find(p => p.id === assigneeId);
    return profile?.full_name || profile?.email || "Не назначен";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Календарь</h1>
          
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="month">Месяц</TabsTrigger>
                <TabsTrigger value="week">Неделя</TabsTrigger>
                <TabsTrigger value="day">День</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Создать событие
            </Button>
          </div>
        </div>

        {/* Навигация по месяцам */}
        <Card className="bg-card border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-6">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-semibold capitalize">
                {format(currentDate, "LLLL yyyy", { locale: ru })}
              </h2>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-px mb-px">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground bg-muted/50"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Календарная сетка */}
            <div className="grid grid-cols-7 gap-px bg-border">
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toString()}
                    onClick={() => {
                      setSelectedDate(day);
                      setView("day");
                    }}
                    className={`
                      min-h-[120px] p-2 bg-card cursor-pointer hover:bg-accent/50 transition-colors
                      ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                      ${isToday ? "ring-2 ring-primary ring-inset" : ""}
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded bg-primary/20 text-primary truncate cursor-pointer hover:bg-primary/30 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(undefined, event);
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 3} еще
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Диалог создания события */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Редактировать событие" : "Новое событие"}</DialogTitle>
              <DialogDescription>
                {editingEvent ? "Измените детали события" : "Добавьте событие в календарь"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название события *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Дата *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Время</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    disabled={formData.all_day}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="all_day"
                  checked={formData.all_day}
                  onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="all_day" className="cursor-pointer">
                  Весь день
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Ответственный</Label>
                <Select
                  value={formData.assignee_id}
                  onValueChange={(value) => setFormData({ ...formData, assignee_id: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
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
                  {mutation.isPending 
                    ? (editingEvent ? "Сохранение..." : "Создание...") 
                    : (editingEvent ? "Сохранить" : "Создать")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
