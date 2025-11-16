import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AuditLogProps {
  organizationId: string;
}

interface LogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export const AuditLog = ({ organizationId }: AuditLogProps) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();

    // Subscribe to new logs
    const channel = supabase
      .channel("audit_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const loadLogs = async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Fetch user profiles separately
      const userIds = [...new Set(logsData?.map((log) => log.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Map profiles to logs
      const logsWithProfiles = logsData?.map((log) => {
        const profile = profiles?.find((p) => p.id === log.user_id);
        return {
          ...log,
          user_name: profile?.full_name || null,
          user_email: profile?.email || null,
        };
      });

      setLogs(logsWithProfiles || []);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю действий",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      create: "default",
      update: "secondary",
      delete: "destructive",
    };

    const labels: Record<string, string> = {
      create: "Создание",
      update: "Изменение",
      delete: "Удаление",
    };

    return (
      <Badge variant={variants[action] || "default"}>
        {labels[action] || action}
      </Badge>
    );
  };

  const getEntityLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      organization: "Организация",
      user: "Пользователь",
      request: "Заявка",
      request_status: "Статус заявки",
      request_priority: "Приоритет заявки",
      settings: "Настройки",
    };

    return labels[entityType] || entityType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <CardTitle>История действий</CardTitle>
        </div>
        <CardDescription>
          Журнал всех изменений в настройках организации
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              История действий пуста
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(log.action)}
                      <span className="text-sm font-medium">
                        {getEntityLabel(log.entity_type)}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {log.user_name || log.user_email || "Пользователь"}
                        </span>
                        {log.action === "create" && " создал(а)"}
                        {log.action === "update" && " изменил(а)"}
                        {log.action === "delete" && " удалил(а)"}
                        {" "}
                        {getEntityLabel(log.entity_type).toLowerCase()}
                      </p>

                      {log.new_values && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "d MMMM yyyy, HH:mm", {
                        locale: ru,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
