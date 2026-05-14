import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type NotifType =
  | "shipment_tomorrow"
  | "arrival_3d"
  | "arrival_1d"
  | "arrival_today"
  | "overdue";

const TYPE_LABELS: Record<NotifType, string> = {
  shipment_tomorrow: "🚛 Завтра отгрузка",
  arrival_3d: "📦 За 3 дня",
  arrival_1d: "⚠️ За 1 день",
  arrival_today: "✅ В день прибытия",
  overdue: "❌ Просрочка",
};

const TYPES: NotifType[] = [
  "shipment_tomorrow",
  "arrival_3d",
  "arrival_1d",
  "arrival_today",
  "overdue",
];

interface Props {
  requestId: string;
  organizationId: string;
}

export function RequestNotificationsCard({ requestId, organizationId }: Props) {
  const [logs, setLogs] = useState<Record<string, { sent_at: string; forced: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [sendingType, setSendingType] = useState<NotifType | "auto" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("request_notification_log" as any)
      .select("notification_type, sent_at, forced")
      .eq("request_id", requestId);
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      map[row.notification_type] = { sent_at: row.sent_at, forced: row.forced };
    });
    setLogs(map);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async (type: NotifType | "auto") => {
    setSendingType(type);
    try {
      const { data, error } = await supabase.functions.invoke(
        "check-shipment-notifications",
        {
          body: {
            requestId,
            organizationId,
            force: true,
          },
        }
      );
      if (error) throw error;
      toast({
        title: "Готово",
        description: `Отправлено: ${data?.sent ?? 0}`,
      });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setSendingType(null);
    }
  };

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Уведомления Telegram
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSend("auto")}
            disabled={sendingType !== null}
            className="gap-1.5 h-7"
          >
            {sendingType === "auto" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Отправить сейчас
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          TYPES.map((t) => {
            const log = logs[t];
            return (
              <div
                key={t}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{TYPE_LABELS[t]}</span>
                  {log ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {format(new Date(log.sent_at), "dd.MM HH:mm", { locale: ru })}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">не отправлено</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-xs"
                  onClick={() => handleSend(t)}
                  disabled={sendingType !== null}
                >
                  {sendingType === t ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : log ? (
                    <RefreshCw className="h-3 w-3" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {log ? "Повторить" : "Отправить"}
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
