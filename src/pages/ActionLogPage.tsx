import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { History, RotateCcw, Search, Filter, Loader2, User, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ActivityLog {
  id: string;
  request_id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string;
  created_at: string;
  snapshot: any;
  request_number?: string;
  user_name?: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Создание",
  status_changed: "Изменение статуса",
  priority_changed: "Изменение приоритета",
  executor_assigned: "Назначение исполнителя",
  executor_removed: "Удаление исполнителя",
  executor_changed: "Смена исполнителя",
  field_changed: "Изменение поля",
  invoice_added: "Добавление счёта",
  photo_added: "Добавление фото",
  document_added: "Добавление документа",
  rollback: "Откат",
  comment: "Комментарий",
  telegram_sent: "Telegram",
  received_confirmed: "Получение подтверждено",
  accepted_no_issues: "Принято без замечаний",
  discrepancy_found: "Несоответствие",
  invoice_sent_to_payment: "В оплату",
  invoice_marked_paid: "Оплачено",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  priority: "Приоритет",
  executor: "Исполнитель",
  amount: "Сумма",
  payment_status: "Статус оплаты",
  payment_percentage: "% оплаты",
  shipment_date: "Дата отгрузки",
  delivery_date: "Дата доставки",
  contractor: "Контрагент",
  invoice_number: "Счёт",
  transport_company: "ТК",
  description: "Описание",
  applicant: "Заявитель",
  object_id: "Объект",
  received_by: "Приёмку ТМЦ осуществил",
};

const ActionLogPage = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: logs, isLoading } = useQuery({
    queryKey: ["action-log", currentOrgId, actionFilter, page],
    queryFn: async () => {
      if (!currentOrgId) return [];
      
      let query = supabase
        .from("request_activities")
        .select("*, requests!inner(request_number)")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] };

      return (data || []).map((log: any) => {
        const profile = profiles?.find(p => p.id === log.user_id);
        return {
          ...log,
          request_number: log.requests?.request_number || "—",
          user_name: profile?.full_name || profile?.email || "Система",
        };
      }) as ActivityLog[];
    },
    enabled: !!currentOrgId,
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ activityId, snapshot, requestId }: { activityId: string; snapshot: any; requestId: string }) => {
      // Extract only updatable fields from snapshot
      const { id, created_at, updated_at, organization_id, created_by, telegram_message_id, telegram_message_ids, awaiting_comment_from, ...updateData } = snapshot;
      
      const { error } = await supabase
        .from("requests")
        .update(updateData)
        .eq("id", requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успешно", description: "Заявка откачена к выбранной версии" });
      queryClient.invalidateQueries({ queryKey: ["action-log"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const filteredLogs = (logs || []).filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.request_number?.toLowerCase().includes(term) ||
      log.description?.toLowerCase().includes(term) ||
      log.user_name?.toLowerCase().includes(term)
    );
  });

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action === "created") return "default";
    if (action === "rollback") return "destructive";
    if (action.includes("changed") || action.includes("assigned")) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Журнал действий</h1>
            <p className="text-sm text-muted-foreground">Полная история изменений всех заявок</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру заявки, описанию, пользователю..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[220px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все действия</SelectItem>
            <SelectItem value="created">Создание</SelectItem>
            <SelectItem value="status_changed">Изменение статуса</SelectItem>
            <SelectItem value="executor_assigned">Назначение исполнителя</SelectItem>
            <SelectItem value="field_changed">Изменение полей</SelectItem>
            <SelectItem value="rollback">Откаты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Записей не найдено
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="divide-y divide-border">
                {filteredLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        <button
                          onClick={() => navigate(`/requests/${log.request_id}`)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          #{log.request_number}
                        </button>
                        {log.field_name && (
                          <span className="text-xs text-muted-foreground">
                            {FIELD_LABELS[log.field_name] || log.field_name}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-foreground">{log.description}</p>

                      {log.old_value && log.new_value && (
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-muted-foreground line-through">{log.old_value}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{log.new_value}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.user_name}
                        </span>
                        <span>
                          {format(new Date(log.created_at), "d MMM yyyy, HH:mm:ss", { locale: ru })}
                        </span>
                      </div>
                    </div>

                    {log.snapshot && log.action !== "rollback" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="shrink-0">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Откатить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Откатить заявку?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Заявка #{log.request_number} будет возвращена к состоянию на момент{" "}
                              {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: ru })}.
                              Это действие будет записано в журнал.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => rollbackMutation.mutate({
                                activityId: log.id,
                                snapshot: log.snapshot,
                                requestId: log.request_id,
                              })}
                            >
                              Подтвердить откат
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Назад
                </Button>
                <span className="text-sm text-muted-foreground">Страница {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filteredLogs?.length || 0) < pageSize}
                  onClick={() => setPage(p => p + 1)}
                >
                  Вперёд →
                </Button>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActionLogPage;
