import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Loader2,
  CheckCircle2,
  Circle,
  Send,
  Bell,
  BellOff,
  MessageSquare,
  Info,
  ExternalLink,
  CalendarClock,
} from "lucide-react";

interface NotificationSettingsProps {
  organizationId: string;
}

export const NotificationSettings = ({ organizationId }: NotificationSettingsProps) => {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { permission, isSupported, isEnabled, requestPermission, sendNotification } = usePushNotifications();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  // Telegram org settings (admin only)
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [invoiceChatId, setInvoiceChatId] = useState("");
  const [procurementChatId, setProcurementChatId] = useState("");
  const [autoSendToProcurement, setAutoSendToProcurement] = useState(true);

  // Notification preferences
  const [autoSendOnCreate, setAutoSendOnCreate] = useState(true);
  const [autoSendOnStatusChange, setAutoSendOnStatusChange] = useState(true);
  const [notifyOnExecutorAssign, setNotifyOnExecutorAssign] = useState(true);
  const [notifyOnComment, setNotifyOnComment] = useState(true);
  const [notifyOnReminder, setNotifyOnReminder] = useState(true);

  // Schedule settings (delivery/shipment reminders)
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [notifyShipmentTomorrow, setNotifyShipmentTomorrow] = useState(true);
  const [notifyArrival3d, setNotifyArrival3d] = useState(true);
  const [notifyArrival1d, setNotifyArrival1d] = useState(true);
  const [notifyArrivalToday, setNotifyArrivalToday] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [sendTime, setSendTime] = useState("09:00");
  const [runningCheck, setRunningCheck] = useState(false);

  // Initial state for change detection
  const [initial, setInitial] = useState({
    botToken: "",
    chatId: "",
    invoiceChatId: "",
    autoSendOnCreate: true,
    autoSendOnStatusChange: true,
    notifyOnExecutorAssign: true,
    notifyOnComment: true,
    notifyOnReminder: true,
  });

  const telegramConnected = !!(botToken && chatId);

  const currentState = useMemo(() => ({
    botToken, chatId, invoiceChatId, procurementChatId,
    autoSendOnCreate, autoSendOnStatusChange, autoSendToProcurement,
    notifyOnExecutorAssign, notifyOnComment, notifyOnReminder,
  }), [botToken, chatId, invoiceChatId, procurementChatId, autoSendOnCreate, autoSendOnStatusChange, autoSendToProcurement, notifyOnExecutorAssign, notifyOnComment, notifyOnReminder]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(currentState) !== JSON.stringify(initial);
  }, [currentState, initial]);

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      setLoading(true);

      if (isAdmin) {
        const { data, error } = await supabase.rpc("get_telegram_credentials", {
          _org_id: organizationId,
        });
        if (!error) {
          const settings = Array.isArray(data) ? data[0] : data;
          if (settings) {
            setBotToken(settings.telegram_bot_token || "");
            setChatId(settings.telegram_chat_id || "");
            setAutoSendOnCreate(settings.telegram_auto_send_on_create ?? true);
            setAutoSendOnStatusChange(settings.telegram_auto_send_on_status_change ?? true);
            setInvoiceChatId(settings.telegram_invoice_chat_id || "");
            setProcurementChatId(settings.telegram_procurement_chat_id || "");
            setAutoSendToProcurement(settings.telegram_auto_send_to_procurement ?? true);

            const loaded = {
              botToken: settings.telegram_bot_token || "",
              chatId: settings.telegram_chat_id || "",
              invoiceChatId: settings.telegram_invoice_chat_id || "",
              procurementChatId: settings.telegram_procurement_chat_id || "",
              autoSendOnCreate: settings.telegram_auto_send_on_create ?? true,
              autoSendOnStatusChange: settings.telegram_auto_send_on_status_change ?? true,
              autoSendToProcurement: settings.telegram_auto_send_to_procurement ?? true,
              notifyOnExecutorAssign: true,
              notifyOnComment: true,
              notifyOnReminder: true,
            };
            setInitial(loaded);
          }
        }
      }

      // Schedule settings (visible to all org members; editable by admins)
      const { data: sched } = await supabase
        .from("notification_schedule_settings" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (sched) {
        const s: any = sched;
        setScheduleEnabled(s.enabled ?? true);
        setNotifyShipmentTomorrow(s.notify_shipment_tomorrow ?? true);
        setNotifyArrival3d(s.notify_arrival_3d ?? true);
        setNotifyArrival1d(s.notify_arrival_1d ?? true);
        setNotifyArrivalToday(s.notify_arrival_today ?? true);
        setNotifyOverdue(s.notify_overdue ?? true);
        setSendTime((s.send_time ?? "09:00").slice(0, 5));
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    if (botToken && !botToken.match(/^\d+:[A-Za-z0-9_-]{30,50}$/)) {
      toast({ variant: "destructive", title: "Ошибка", description: "Неверный формат токена бота" });
      return;
    }
    if (chatId && !chatId.match(/^-?\d+$/)) {
      toast({ variant: "destructive", title: "Ошибка", description: "Chat ID должен быть числом" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("telegram_settings" as any)
        .upsert({
          organization_id: organizationId,
          bot_token: botToken || null,
          chat_id: chatId || null,
          auto_send_on_create: autoSendOnCreate,
          auto_send_on_status_change: autoSendOnStatusChange,
          invoice_chat_id: invoiceChatId || null,
          procurement_chat_id: procurementChatId || null,
          auto_send_to_procurement: autoSendToProcurement,
        } as any, { onConflict: "organization_id" });

      if (error) throw error;

      setInitial({ ...currentState });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramConnected) return;
    setTestingSend(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          action: "test_personal",
          telegramUserId: parseInt(chatId),
          organizationId,
        },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast({ variant: "destructive", title: "Ошибка", description: data.error });
        return;
      }
      toast({ title: "Отправлено", description: "Тестовое сообщение отправлено" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message });
    } finally {
      setTestingSend(false);
    }
  };

  const handleTestPush = async () => {
    await sendNotification("Тестовое уведомление", {
      body: "Push-уведомления работают корректно!",
      link: "/organization/settings",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-[600px] space-y-8">
      {/* ========== TELEGRAM — основной канал ========== */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Telegram
            </h3>
            <span className="text-xs text-muted-foreground">основной канал</span>
          </div>
          {telegramConnected ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Подключено
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <Circle className="h-3 w-3" />
              Не подключено
            </Badge>
          )}
        </div>
        <Separator />

        {isAdmin && (
          <div className="space-y-4">
            {/* Connection fields */}
            <FieldRow label="Токен бота">
              <Input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Вставьте токен от BotFather"
              />
            </FieldRow>

            <FieldRow label="Chat ID">
              <Input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890"
              />
            </FieldRow>

            <FieldRow label="Chat ID для счетов" optional>
              <Input
                value={invoiceChatId}
                onChange={(e) => setInvoiceChatId(e.target.value)}
                placeholder="-1001234567890"
              />
            </FieldRow>

            <FieldRow label="Chat ID группы закупок" optional>
              <Input
                value={procurementChatId}
                onChange={(e) => setProcurementChatId(e.target.value)}
                placeholder="-1001234567890"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Группа для первичной обработки заявок: назначение исполнителя перед отправкой в основной чат.
              </p>
            </FieldRow>

            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground leading-relaxed">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Создайте бота через{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="h-3 w-3" />
                </a>
                , добавьте его в группу и укажите Chat ID.
              </span>
            </div>
          </div>
        )}

        {!isAdmin && !telegramConnected && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground leading-relaxed">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Telegram-уведомления настраиваются администратором организации.</span>
          </div>
        )}

        {/* Notification event toggles */}
        <div className="space-y-3 pt-1">
          <p className="text-sm font-semibold text-foreground">Какие события отправлять</p>

          <ToggleRow
            label="Новая заявка"
            checked={autoSendOnCreate}
            onCheckedChange={isAdmin ? setAutoSendOnCreate : undefined}
            disabled={!isAdmin}
          />
          <ToggleRow
            label="Изменение статуса"
            checked={autoSendOnStatusChange}
            onCheckedChange={isAdmin ? setAutoSendOnStatusChange : undefined}
            disabled={!isAdmin}
          />
          <ToggleRow
            label="Отправлять в группу закупок"
            checked={autoSendToProcurement}
            onCheckedChange={isAdmin ? setAutoSendToProcurement : undefined}
            disabled={!isAdmin}
          />
          <ToggleRow
            label="Назначение исполнителя"
            checked={notifyOnExecutorAssign}
            onCheckedChange={setNotifyOnExecutorAssign}
          />
          <ToggleRow
            label="Новый комментарий"
            checked={notifyOnComment}
            onCheckedChange={setNotifyOnComment}
          />
          <ToggleRow
            label="Напоминания о дедлайнах"
            checked={notifyOnReminder}
            onCheckedChange={setNotifyOnReminder}
          />
        </div>

        {/* Test button */}
        {telegramConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestTelegram}
            disabled={testingSend}
            className="gap-2"
          >
            {testingSend ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Отправить тестовое сообщение
          </Button>
        )}
      </section>

      {/* ========== PUSH — дополнительный канал ========== */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Браузерные уведомления
            </h3>
            <span className="text-xs text-muted-foreground">дополнительный</span>
          </div>
          {isEnabled ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Включено
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <Circle className="h-3 w-3" />
              Выключено
            </Badge>
          )}
        </div>
        <Separator />

        {permission === "denied" && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-[13px] text-destructive leading-relaxed">
            <BellOff className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Уведомления заблокированы в браузере. Нажмите на иконку замка в адресной строке → Уведомления → Разрешить.
            </span>
          </div>
        )}

        {!isEnabled && permission !== "denied" && isSupported && (
          <Button onClick={requestPermission} variant="outline" size="sm" className="gap-2">
            <Bell className="h-3.5 w-3.5" />
            Включить уведомления
          </Button>
        )}

        {isEnabled && (
          <Button variant="outline" size="sm" onClick={handleTestPush} className="gap-2">
            <Send className="h-3.5 w-3.5" />
            Отправить тест
          </Button>
        )}

        {!telegramConnected && isEnabled && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground leading-relaxed">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Telegram не подключён — push-уведомления используются как основной канал.</span>
          </div>
        )}
      </section>

      {/* ========== Save ========== */}
      {isAdmin && (
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto min-w-[200px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Сохранено
              </>
            ) : (
              "Сохранить изменения"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

/* ---- helpers ---- */

function FieldRow({
  label,
  children,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1.5 sm:gap-4 items-start sm:items-center">
      <Label className="text-sm text-muted-foreground pt-0 sm:pt-2.5">
        {label}
        {optional && <span className="text-xs text-muted-foreground/60 ml-1">(опц.)</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="font-normal text-sm">{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || !onCheckedChange}
      />
    </div>
  );
}
