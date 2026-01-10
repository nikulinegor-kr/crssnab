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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, setMonth, setYear, getYear, getMonth, isWeekend, getDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Российские праздничные дни (фиксированные)
const HOLIDAYS_2025: { [key: string]: string } = {
  "01-01": "Новый год",
  "01-02": "Новогодние каникулы",
  "01-03": "Новогодние каникулы",
  "01-04": "Новогодние каникулы",
  "01-05": "Новогодние каникулы",
  "01-06": "Новогодние каникулы",
  "01-07": "Рождество Христово",
  "01-08": "Новогодние каникулы",
  "02-23": "День защитника Отечества",
  "03-08": "Международный женский день",
  "05-01": "Праздник Весны и Труда",
  "05-09": "День Победы",
  "06-12": "День России",
  "11-04": "День народного единства",
};

const HOLIDAYS_2026: { [key: string]: string } = {
  "01-01": "Новый год",
  "01-02": "Новогодние каникулы",
  "01-03": "Новогодние каникулы",
  "01-04": "Новогодние каникулы",
  "01-05": "Новогодние каникулы",
  "01-06": "Новогодние каникулы",
  "01-07": "Рождество Христово",
  "01-08": "Новогодние каникулы",
  "02-23": "День защитника Отечества",
  "03-08": "Международный женский день",
  "05-01": "Праздник Весны и Труда",
  "05-09": "День Победы",
  "06-12": "День России",
  "11-04": "День народного единства",
};

// Календарь бухгалтера ИП на УСН - сроки сдачи отчётности и уплаты налогов
interface AccountantDeadline {
  date: string; // MM-DD
  title: string;
  description: string;
  type: "tax" | "report" | "insurance";
}

const ACCOUNTANT_DEADLINES_2026: AccountantDeadline[] = [
  // 1 квартал
  { date: "01-09", title: "Уплата страховых взносов за декабрь", description: "Страховые взносы за сотрудников за декабрь 2025", type: "insurance" },
  { date: "01-25", title: "Уведомление по НДФЛ", description: "Уведомление об исчисленных суммах НДФЛ", type: "report" },
  { date: "01-28", title: "Аванс УСН за 4 квартал", description: "Авансовый платёж по УСН за 4 квартал 2025", type: "tax" },
  { date: "02-28", title: "Уплата страховых взносов за январь", description: "Страховые взносы за сотрудников за январь", type: "insurance" },
  { date: "03-01", title: "6-НДФЛ за год", description: "Расчёт 6-НДФЛ за 2025 год", type: "report" },
  { date: "03-28", title: "Страховые взносы за февраль", description: "Страховые взносы за сотрудников за февраль", type: "insurance" },
  
  // 2 квартал  
  { date: "04-25", title: "Декларация УСН за год", description: "Декларация по УСН за 2025 год (для ИП)", type: "report" },
  { date: "04-28", title: "Налог УСН за год", description: "Уплата налога по УСН за 2025 год", type: "tax" },
  { date: "04-28", title: "Аванс УСН за 1 квартал", description: "Авансовый платёж по УСН за 1 квартал 2026", type: "tax" },
  { date: "04-28", title: "Страховые взносы за март", description: "Страховые взносы за сотрудников за март", type: "insurance" },
  { date: "05-28", title: "Страховые взносы за апрель", description: "Страховые взносы за сотрудников за апрель", type: "insurance" },
  { date: "06-28", title: "Страховые взносы за май", description: "Страховые взносы за сотрудников за май", type: "insurance" },

  // 3 квартал
  { date: "07-25", title: "6-НДФЛ за полугодие", description: "Расчёт 6-НДФЛ за полугодие 2026", type: "report" },
  { date: "07-28", title: "Аванс УСН за 2 квартал", description: "Авансовый платёж по УСН за 2 квартал (полугодие)", type: "tax" },
  { date: "07-28", title: "Страховые взносы за июнь", description: "Страховые взносы за сотрудников за июнь", type: "insurance" },
  { date: "08-28", title: "Страховые взносы за июль", description: "Страховые взносы за сотрудников за июль", type: "insurance" },
  { date: "09-28", title: "Страховые взносы за август", description: "Страховые взносы за сотрудников за август", type: "insurance" },

  // 4 квартал
  { date: "10-25", title: "6-НДФЛ за 9 месяцев", description: "Расчёт 6-НДФЛ за 9 месяцев 2026", type: "report" },
  { date: "10-28", title: "Аванс УСН за 3 квартал", description: "Авансовый платёж по УСН за 3 квартал (9 месяцев)", type: "tax" },
  { date: "10-28", title: "Страховые взносы за сентябрь", description: "Страховые взносы за сотрудников за сентябрь", type: "insurance" },
  { date: "11-28", title: "Страховые взносы за октябрь", description: "Страховые взносы за сотрудников за октябрь", type: "insurance" },
  { date: "12-28", title: "Страховые взносы за ноябрь", description: "Страховые взносы за сотрудников за ноябрь", type: "insurance" },
  { date: "12-31", title: "Фиксированные взносы ИП", description: "Уплата фиксированных страховых взносов ИП за себя", type: "insurance" },
];

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
      queryClient.invalidateQueries({ queryKey: ["calendar-events", currentOrgId] });
      toast({
        title: editingEvent ? "Событие обновлено" : "Событие создано",
        description: editingEvent 
          ? "Событие успешно обновлено"
          : "Новое событие успешно добавлено в календарь",
      });
      
      // После создания/редактирования переключаемся на месяц с датой события
      if (formData.start_date) {
        const eventDate = new Date(formData.start_date);
        setCurrentDate(eventDate);
        setSelectedDate(eventDate);
        setView("month");
      }
      
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
      queryClient.invalidateQueries({ queryKey: ["calendar-events", currentOrgId] });
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
    if (!events) return [];

    const dayStr = format(day, "yyyy-MM-dd");
    
    return events.filter(event => {
      if (!event.start_date) return false;
      const eventDateStr = event.start_date.slice(0, 10); // YYYY-MM-DD
      return eventDateStr === dayStr;
    });
  };

  // Проверка праздничного дня
  const getHoliday = (day: Date): string | null => {
    const year = getYear(day);
    const monthDay = format(day, "MM-dd");
    const holidays = year === 2025 ? HOLIDAYS_2025 : HOLIDAYS_2026;
    return holidays[monthDay] || null;
  };

  // Получение событий бухгалтера для дня
  const getAccountantDeadlines = (day: Date): AccountantDeadline[] => {
    const monthDay = format(day, "MM-dd");
    return ACCOUNTANT_DEADLINES_2026.filter(d => d.date === monthDay);
  };

  // Проверка, является ли день выходным или праздничным
  const isHolidayOrWeekend = (day: Date): { isWeekend: boolean; isHoliday: boolean; holidayName: string | null } => {
    const dayOfWeek = getDay(day);
    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6; // 0 = воскресенье, 6 = суббота
    const holidayName = getHoliday(day);
    return {
      isWeekend: isWeekendDay,
      isHoliday: !!holidayName,
      holidayName
    };
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
    const { isWeekend: isWeekendDay, isHoliday, holidayName } = isHolidayOrWeekend(dayToShow);
    const accountantDeadlines = getAccountantDeadlines(dayToShow);
    
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
            <div className="text-center">
              <h2 className={`text-xl font-semibold ${isHoliday || isWeekendDay ? "text-red-500" : ""}`}>
                {format(dayToShow, "d MMMM yyyy, EEEE", { locale: ru })}
              </h2>
              {holidayName && (
                <div className="text-sm text-red-500">🎉 {holidayName}</div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              const nextDay = new Date(dayToShow);
              nextDay.setDate(nextDay.getDate() + 1);
              setSelectedDate(nextDay);
            }}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Сроки бухгалтера */}
          {accountantDeadlines.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium mb-2">📋 Сроки бухгалтера ИП на УСН</div>
              <div className="space-y-2">
                {accountantDeadlines.map((deadline, idx) => (
                  <div 
                    key={idx}
                    className={`p-2 rounded-md text-sm ${
                      deadline.type === "tax" 
                        ? "bg-orange-500/20 border border-orange-500/30" 
                        : deadline.type === "report"
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-green-500/20 border border-green-500/30"
                    }`}
                  >
                    <div className={`font-medium ${
                      deadline.type === "tax" 
                        ? "text-orange-700 dark:text-orange-300" 
                        : deadline.type === "report"
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-green-700 dark:text-green-300"
                    }`}>
                      {deadline.title}
                    </div>
                    <div className="text-muted-foreground text-xs mt-1">{deadline.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

              {/* Легенда */}
              <div className="flex flex-wrap gap-4 mb-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300"></div>
                  <span>Выходные/праздники</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500"></div>
                  <span>Налоги</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span>Отчётность</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span>Страховые взносы</span>
                </div>
              </div>

              {/* Дни недели */}
              <div className="grid grid-cols-7 gap-px mb-px">
                {weekDays.map((day, index) => (
                  <div
                    key={day}
                    className={`p-2 text-center text-sm font-medium bg-muted/50 ${
                      index >= 5 ? "text-red-500" : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Календарная сетка */}
              <TooltipProvider>
                <div className="grid grid-cols-7 gap-px bg-border">
                  {days.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    const { isWeekend: isWeekendDay, isHoliday, holidayName } = isHolidayOrWeekend(day);
                    const accountantDeadlines = getAccountantDeadlines(day);

                    return (
                      <Tooltip key={day.toString()}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => {
                              setSelectedDate(day);
                              setView("day");
                            }}
                            className={`
                              min-h-[60px] sm:min-h-[80px] md:min-h-[120px] p-1 sm:p-2 cursor-pointer hover:bg-accent/50 transition-colors
                              ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                              ${isToday ? "ring-2 ring-primary ring-inset" : ""}
                              ${isHoliday || isWeekendDay ? "bg-red-50 dark:bg-red-950/20" : "bg-card"}
                            `}
                          >
                            <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 flex items-center gap-1 ${
                              isToday ? "text-primary" : isHoliday || isWeekendDay ? "text-red-500" : ""
                            }`}>
                              {format(day, "d")}
                              {isHoliday && <span className="text-[8px]">🎉</span>}
                            </div>
                            
                            {/* События бухгалтера */}
                            <div className="space-y-0.5">
                              {accountantDeadlines.slice(0, 1).map((deadline, idx) => (
                                <div
                                  key={idx}
                                  className={`text-[8px] sm:text-[10px] p-0.5 rounded truncate ${
                                    deadline.type === "tax" 
                                      ? "bg-orange-500/20 text-orange-700 dark:text-orange-300" 
                                      : deadline.type === "report"
                                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                      : "bg-green-500/20 text-green-700 dark:text-green-300"
                                  }`}
                                >
                                  {deadline.title}
                                </div>
                              ))}
                              {accountantDeadlines.length > 1 && (
                                <div className="text-[8px] text-muted-foreground">
                                  +{accountantDeadlines.length - 1} сроков
                                </div>
                              )}
                            </div>

                            {/* Обычные события */}
                            <div className="space-y-0.5 mt-0.5">
                              {dayEvents.slice(0, accountantDeadlines.length > 0 ? 1 : 2).map((event) => (
                                <div
                                  key={event.id}
                                  className={`text-[10px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity border ${getPriorityColor(event.priority)}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDialog(undefined, event);
                                  }}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {dayEvents.length > (accountantDeadlines.length > 0 ? 1 : 2) && (
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  +{dayEvents.length - (accountantDeadlines.length > 0 ? 1 : 2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        {(isHoliday || accountantDeadlines.length > 0) && (
                          <TooltipContent side="top" className="max-w-[250px]">
                            <div className="space-y-1">
                              {holidayName && (
                                <div className="font-medium text-red-500">🎉 {holidayName}</div>
                              )}
                              {accountantDeadlines.map((deadline, idx) => (
                                <div key={idx} className="text-xs">
                                  <div className={`font-medium ${
                                    deadline.type === "tax" 
                                      ? "text-orange-500" 
                                      : deadline.type === "report"
                                      ? "text-blue-500"
                                      : "text-green-500"
                                  }`}>
                                    {deadline.title}
                                  </div>
                                  <div className="text-muted-foreground">{deadline.description}</div>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
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
