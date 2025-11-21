import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, setMonth, setYear, getYear, getMonth } from "date-fns";
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
  priority: string | null;
  request_id: string | null;
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
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<"month" | "day">("month");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    start_time: "09:00",
    all_day: false,
    assignee_id: "",
    priority: "Средний",
  });

  // Генерация временных слотов с шагом 30 минут
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = (i % 2 === 0 ? '00' : '30');
    return `${hours}:${minutes}`;
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
      // Check for upcoming events and create notifications
      try {
        await supabase.functions.invoke('check-event-notifications');
      } catch (error) {
        console.error('Failed to check event notifications:', error);
      }

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
            assignee_id: data.assignee_id || null,
            priority: data.priority
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
            assignee_id: data.assignee_id || null,
            priority: data.priority,
            event_type: "manual"
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

  // Удаление события
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: "Событие удалено",
        description: "Событие успешно удалено из календаря",
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
  const handleMonthChange = (month: number) => setCurrentDate(setMonth(currentDate, month));
  const handleYearChange = (year: number) => setCurrentDate(setYear(currentDate, year));

  const handleOpenDialog = (date?: Date, event?: CalendarEvent) => {
    // Если это событие из заявки (отгрузка или доставка), перейти к заявке
    if (event && event.request_id && (event.event_type === 'shipment' || event.event_type === 'delivery')) {
      navigate(`/requests/${event.request_id}`);
      return;
    }

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
        priority: event.priority || "Средний",
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
      priority: "Средний",
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

  // Функция для определения, можно ли редактировать событие
  const isEventEditable = (event: CalendarEvent | null) => {
    if (!event) return true; // Новое событие - можно редактировать
    // Событие редактируемое если это не событие из заявки
    return event.event_type !== 'shipment' && event.event_type !== 'delivery';
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "Высокий":
        return "bg-red-500/20 text-red-600 border-red-500";
      case "Средний":
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500";
      case "Низкий":
        return "bg-green-500/20 text-green-600 border-green-500";
      default:
        return "bg-primary/20 text-primary border-primary";
    }
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  const renderDayView = () => {
    const dayToShow = selectedDate || new Date();
    const dayEvents = getEventsForDay(dayToShow);
    
    return (
      <Card className="bg-card border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => {
              setSelectedDate(subMonths(dayToShow, 0));
              const prevDay = new Date(dayToShow);
              prevDay.setDate(prevDay.getDate() - 1);
              setSelectedDate(prevDay);
            }}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold">
              {format(dayToShow, "d MMMM yyyy, EEEE", { locale: ru })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => {
              const nextDay = new Date(dayToShow);
              nextDay.setDate(nextDay.getDate() + 1);
              setSelectedDate(nextDay);
            }}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {timeSlots.map((time) => {
              const eventsAtTime = dayEvents.filter(event => {
                if (event.all_day) return time === "00:00";
                const eventTime = format(new Date(event.start_date), "HH:mm");
                return eventTime === time;
              });

              return (
                <div key={time} className="flex gap-2 min-h-[50px] border-b border-border/20">
                  <div className="w-16 flex-shrink-0 text-sm text-muted-foreground py-2">
                    {time}
                  </div>
                  <div className="flex-1 py-1">
                    {eventsAtTime.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleOpenDialog(undefined, event)}
                        className={`p-2 rounded-md cursor-pointer hover:opacity-80 transition-opacity mb-1 border ${getPriorityColor(event.priority)}`}
                      >
                        <div className="font-medium text-sm">{event.title}</div>
                        {event.description && (
                          <div className="text-xs opacity-80 mt-1">{event.description}</div>
                        )}
                        {event.assignee_id && (
                          <div className="text-xs opacity-70 mt-1">
                            👤 {getAssigneeName(event.assignee_id)}
                          </div>
                        )}
                        {event.request_id && (event.event_type === 'shipment' || event.event_type === 'delivery') && (
                          <div className="text-xs opacity-70 mt-1 italic">
                            📋 Нажмите для перехода к заявке
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
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
                <TabsTrigger value="day">День</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Создать событие
            </Button>
          </div>
        </div>

        {/* Отображение в зависимости от вида */}
        {view === "day" ? renderDayView() : (
          <Card className="bg-card border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Select value={getMonth(currentDate).toString()} onValueChange={(value) => handleMonthChange(parseInt(value))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {format(new Date(2024, i), "LLLL", { locale: ru })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={getYear(currentDate).toString()} onValueChange={(value) => handleYearChange(parseInt(value))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = getYear(new Date()) - 5 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
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
                            className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity border ${getPriorityColor(event.priority)}`}
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
        )}

        {/* Диалог создания события */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEvent?.request_id && (editingEvent.event_type === 'shipment' || editingEvent.event_type === 'delivery') 
                  ? (editingEvent.event_type === 'shipment' ? "Событие отгрузки из заявки" : "Событие доставки из заявки")
                  : (editingEvent ? "Редактировать событие" : "Новое событие")
                }
              </DialogTitle>
              <DialogDescription>
                {editingEvent?.request_id && (editingEvent.event_type === 'shipment' || editingEvent.event_type === 'delivery')
                  ? "Это событие создано автоматически из заявки и не может быть отредактировано"
                  : (editingEvent ? "Измените детали события" : "Добавьте событие в календарь")
                }
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
                  disabled={!isEventEditable(editingEvent)}
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
                  disabled={!isEventEditable(editingEvent)}
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
                    disabled={!isEventEditable(editingEvent)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Время</Label>
                  <Select
                    value={formData.start_time}
                    onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                    disabled={formData.all_day || !isEventEditable(editingEvent)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Выберите время" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="all_day"
                  checked={formData.all_day}
                  onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                  disabled={!isEventEditable(editingEvent)}
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
                  disabled={!isEventEditable(editingEvent)}
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

              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  disabled={!isEventEditable(editingEvent)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Высокий">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        Высокий
                      </span>
                    </SelectItem>
                    <SelectItem value="Средний">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        Средний
                      </span>
                    </SelectItem>
                    <SelectItem value="Низкий">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        Низкий
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isEventEditable(editingEvent) && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded flex items-start gap-2">
                  <span>ℹ️</span>
                  <span>Это событие создано автоматически из заявки и не может быть отредактировано. Кликните на событие, чтобы перейти к заявке.</span>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row justify-between gap-2">
                <div className="flex-1">
                  {editingEvent && isEventEditable(editingEvent) && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => {
                        if (confirm("Вы уверены, что хотите удалить это событие?")) {
                          deleteMutation.mutate(editingEvent.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {deleteMutation.isPending ? "Удаление..." : "Удалить событие"}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseDialog}
                    className="flex-1 sm:flex-none"
                  >
                    Отменить
                  </Button>
                  {isEventEditable(editingEvent) && (
                    <Button 
                      type="submit" 
                      disabled={mutation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      {mutation.isPending 
                        ? (editingEvent ? "Сохранение..." : "Создание...") 
                        : (editingEvent ? "Сохранить" : "Создать")}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
