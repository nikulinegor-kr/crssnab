import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalIcon, Activity } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  created: "Создано заявок",
  status_changed: "Смена статуса",
  priority_changed: "Смена приоритета",
  executor_assigned: "Назначен исполнитель",
  executor_changed: "Смена исполнителя",
  executor_removed: "Снят исполнитель",
  field_changed: "Правки полей",
  invoice_added: "Добавлен счёт",
  invoice_sent_to_payment: "Счёт в оплату",
  invoice_marked_paid: "Счёт оплачен",
  document_added: "Добавлен документ",
  photo_added: "Добавлено фото",
  received_confirmed: "Приёмка ТМЦ",
  accepted_no_issues: "Приёмка без замечаний",
  discrepancy_found: "Найдено расхождение",
  delivery_reminder_sent: "Напоминание о доставке",
};

interface Props {
  executorName: string;
}

export function ExecutorDaySummary({ executorName }: Props) {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const [day, setDay] = useState<Date>(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["executor-day-summary", currentOrgId, executorName, format(day, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!currentOrgId) return null;

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", executorName.trim());
      const userIds = (profs || []).map((p) => p.id);

      const from = startOfDay(day).toISOString();
      const to = endOfDay(day).toISOString();

      let acts: any[] = [];
      if (userIds.length > 0) {
        const { data: a, error } = await supabase
          .from("request_activities")
          .select("id, action, field_name, old_value, new_value, description, created_at, request_id, requests(description, request_number)")
          .eq("organization_id", currentOrgId)
          .in("user_id", userIds)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false });
        if (error) throw error;
        acts = a || [];
      }

      const { data: assigned } = await supabase
        .from("requests")
        .select("id, description, status, request_number")
        .eq("organization_id", currentOrgId)
        .eq("executor", executorName)
        .gte("updated_at", from)
        .lte("updated_at", to);

      return { acts, assigned: assigned || [], hasProfile: userIds.length > 0 };
    },
    enabled: !!currentOrgId && !!executorName,
  });

  const counts = (data?.acts || []).reduce<Record<string, number>>((acc, a) => {
    acc[a.action] = (acc[a.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Сводка за день
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <CalIcon className="h-3.5 w-3.5" />
              {format(day, "dd.MM.yyyy", { locale: ru })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={day}
              onSelect={(d) => d && setDay(d)}
              locale={ru}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {!data?.hasProfile && (
              <p className="text-xs text-muted-foreground">
                Профиль сотрудника не найден по ФИО — показаны только заявки, обновлённые за день.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {Object.keys(counts).length === 0 ? (
                <p className="text-sm text-muted-foreground">Действий за этот день нет</p>
              ) : (
                Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([action, n]) => (
                    <Badge key={action} variant="secondary" className="font-normal">
                      {ACTION_LABELS[action] || action}: <span className="ml-1 font-semibold">{n}</span>
                    </Badge>
                  ))
              )}
            </div>

            {(data?.acts?.length || 0) > 0 && (
              <ScrollArea className="h-[320px] pr-3">
                <ul className="space-y-2">
                  {data!.acts.map((a: any) => (
                    <li
                      key={a.id}
                      className="cursor-pointer rounded-md border p-2.5 text-sm hover:bg-muted/50"
                      onClick={() => navigate(`/requests/${a.request_id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {a.requests?.description || "Без названия"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ACTION_LABELS[a.action] || a.action}
                            {a.description ? ` — ${a.description}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 font-numeric text-xs text-muted-foreground">
                          {format(new Date(a.created_at), "HH:mm")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Заявки сотрудника, затронутые за день: {data?.assigned.length || 0}
              </p>
              <div className="flex flex-wrap gap-2">
                {(data?.assigned || []).slice(0, 12).map((r: any) => (
                  <Badge
                    key={r.id}
                    variant="outline"
                    className="cursor-pointer font-normal"
                    onClick={() => navigate(`/requests/${r.id}`)}
                  >
                    {r.description || "Без названия"} · {r.status}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
