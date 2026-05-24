import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Bot, Info, ExternalLink, Copy, Send, Trash2, RefreshCw,
  Webhook, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface TelegramSettingsProps {
  organizationId: string;
}

const NOTIFICATION_TYPES = [
  { value: "supply", label: "Поставка ТМЦ" },
  { value: "invoice", label: "Счета на оплату" },
  { value: "request", label: "Входящие заявки" },
  { value: "alert", label: "CRSS оповещения" },
  { value: "general", label: "Общие" },
] as const;

interface TgGroup {
  id: string;
  organization_id: string | null;
  group_id: string;
  group_name: string;
  notification_type: string;
  is_active: boolean;
  is_discovered: boolean;
  chat_type: string | null;
  last_message_at: string | null;
  last_api_status: number | null;
  last_api_at: string | null;
}

interface WebhookLog {
  id: string;
  event_type: string | null;
  group_id: string | null;
  chat_id: string | null;
  group_name: string | null;
  payload: any;
  created_at: string;
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`;

const labelForType = (v: string) =>
  NOTIFICATION_TYPES.find((t) => t.value === v)?.label || v;

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
};

const eventLabel = (t: string | null) => {
  const map: Record<string, string> = {
    incoming_raw: "Входящий webhook",
    outgoing_ok: "Отправлено ✓",
    outgoing_error: "Ошибка отправки",
  };
  return map[t || ""] || t || "—";
};

const eventVariant = (t: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!t) return "outline";
  if (t.includes("error")) return "destructive";
  if (t === "outgoing_ok") return "default";
  return "secondary";
};

function summarizePayload(p: any): string {
  if (!p) return "";
  if (typeof p === "string") return p.slice(0, 200);
  if (p.status) return `status: ${p.status}${p.response ? " · " + JSON.stringify(p.response).slice(0, 140) : ""}`;
  if (p.message?.text) return `«${p.message.text}»`;
  if (p.text) return `«${String(p.text).slice(0, 200)}»`;
  return JSON.stringify(p).slice(0, 200);
}

export const TelegramSettings = ({ organizationId }: TelegramSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [autoSendOnCreate, setAutoSendOnCreate] = useState(true);
  const [autoSendOnStatusChange, setAutoSendOnStatusChange] = useState(true);
  const [invoiceChatId, setInvoiceChatId] = useState("");
  const [procurementChatId, setProcurementChatId] = useState("");
  const [deadlineChatId, setDeadlineChatId] = useState("");
  const [autoSendToProcurement, setAutoSendToProcurement] = useState(true);

  const [groups, setGroups] = useState<TgGroup[]>([]);
  const [discovered, setDiscovered] = useState<TgGroup[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSettings();
    loadGroups();
    // eslint-disable-next-line
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.rpc('get_telegram_credentials', {
        _org_id: organizationId,
      });
      if (error) throw error;
      const settings = Array.isArray(data) ? data[0] : data;
      if (settings) {
        setBotToken(settings.telegram_bot_token || "");
        setChatId(settings.telegram_chat_id || "");
        setAutoSendOnCreate(settings.telegram_auto_send_on_create ?? true);
        setAutoSendOnStatusChange(settings.telegram_auto_send_on_status_change ?? true);
        setInvoiceChatId(settings.telegram_invoice_chat_id || "");
        setProcurementChatId(settings.telegram_procurement_chat_id || "");
        setDeadlineChatId(settings.telegram_deadline_chat_id || "");
        setAutoSendToProcurement(settings.telegram_auto_send_to_procurement ?? true);
      }
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки. Убедитесь, что у вас есть права администратора.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    setGroupsLoading(true);
    const [orgRes, discRes, logsRes] = await Promise.all([
      supabase.from("telegram_groups" as any)
        .select("*").eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase.from("telegram_groups" as any)
        .select("*").is("organization_id", null)
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase.from("telegram_webhook_logs" as any)
        .select("*").order("created_at", { ascending: false }).limit(25),
    ]);
    setGroups((orgRes.data || []) as any);
    setDiscovered((discRes.data || []) as any);
    setLogs((logsRes.data || []) as any);
    setGroupsLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
    toast({ title: "Обновлено", description: "Список групп и событий обновлён" });
  };

  const claim = async (g: TgGroup, type: string) => {
    setBusy(true);
    const { error } = await supabase.from("telegram_groups" as any)
      .update({ organization_id: organizationId, notification_type: type, is_discovered: false })
      .eq("id", g.id);
    setBusy(false);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else { toast({ title: "Группа привязана" }); loadGroups(); }
  };

  const setType = async (g: TgGroup, type: string) => {
    const { error } = await supabase.from("telegram_groups" as any)
      .update({ notification_type: type }).eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else loadGroups();
  };

  const toggle = async (g: TgGroup) => {
    const { error } = await supabase.from("telegram_groups" as any)
      .update({ is_active: !g.is_active }).eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else loadGroups();
  };

  const remove = async (g: TgGroup) => {
    if (!confirm(`Удалить группу «${g.group_name}»?`)) return;
    const { error } = await supabase.from("telegram_groups" as any).delete().eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else loadGroups();
  };

  const sendTest = async (g: TgGroup) => {
    setTesting(g.id);
    const { data, error } = await supabase.functions.invoke("telegram-debug-send", {
      body: {
        organization_id: organizationId,
        chat_id: g.group_id,
        text: `🔔 Тестовое уведомление CRSS CRM\nГруппа: ${g.group_name}\nТип: ${labelForType(g.notification_type)}`,
      },
    });
    setTesting(null);
    if (error || (data as any)?.ok === false) {
      toast({
        title: "Не отправлено",
        description: error?.message || (data as any)?.error || "Проверьте подключение бота",
        variant: "destructive",
      });
    } else {
      toast({ title: "Тестовое уведомление отправлено" });
    }
    loadGroups();
  };

  const copyText = async (text: string, label = "Скопировано") => {
    await navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const apiStatusBadge = (g: TgGroup) => {
    if (g.last_api_status == null) {
      return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Нет данных</Badge>;
    }
    const ok = g.last_api_status >= 200 && g.last_api_status < 300;
    return (
      <Badge variant={ok ? "default" : "destructive"} className="gap-1 font-numeric">
        {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {g.last_api_status}
      </Badge>
    );
  };

  const webhookBadge = (g: TgGroup) => {
    if (!g.last_message_at) return <Badge variant="outline">Нет сообщений</Badge>;
    const ageH = (Date.now() - new Date(g.last_message_at).getTime()) / 3.6e6;
    if (ageH < 24) return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Активен</Badge>;
    return <Badge variant="secondary">Тихо {Math.floor(ageH / 24)}д</Badge>;
  };

  const handleSave = async () => {
    if (botToken && !botToken.match(/^\d+:[A-Za-z0-9_-]{30,50}$/)) {
      toast({ title: "Ошибка", description: "Неверный формат токена бота", variant: "destructive" });
      return;
    }
    if (chatId && !chatId.match(/^-?\d+$/)) {
      toast({ title: "Ошибка", description: "Chat ID должен быть числом", variant: "destructive" });
      return;
    }
    if (deadlineChatId && !deadlineChatId.match(/^-?\d+$/)) {
      toast({ title: "Ошибка", description: "Chat ID для уведомлений по срокам должен быть числом", variant: "destructive" });
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
          deadline_chat_id: deadlineChatId || null,
          auto_send_to_procurement: autoSendToProcurement,
        } as any, { onConflict: "organization_id" });

      if (error) throw error;
      toast({ title: "Успешно", description: "Настройки сохранены" });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>Telegram уведомления</CardTitle>
          </div>
          <CardDescription>
            Подключите Telegram бота для получения уведомлений о заявках
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Как подключить бота:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Найдите <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">@BotFather <ExternalLink className="h-3 w-3" /></a> в Telegram</li>
                  <li>Отправьте команду <code className="bg-muted px-1 py-0.5 rounded">/newbot</code></li>
                  <li>Следуйте инструкциям и получите токен бота</li>
                  <li>Добавьте бота в вашу группу/канал</li>
                  <li>Отправьте сообщение в группу (или команду <code className="bg-muted px-1 rounded">/id</code>) — она появится в списке ниже</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Токен бота</Label>
              <Input id="botToken" type="password" placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={botToken} onChange={(e) => setBotToken(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Формат: <code className="bg-muted px-1 py-0.5 rounded">123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chatId">Chat ID группы/канала</Label>
              <Input id="chatId" type="text" placeholder="-1001234567890"
                value={chatId} onChange={(e) => setChatId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Для групп обычно начинается с <code className="bg-muted px-1 py-0.5 rounded">-100</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceChatId">Chat ID для счетов (необязательно)</Label>
              <Input id="invoiceChatId" type="text" placeholder="-1001234567890"
                value={invoiceChatId} onChange={(e) => setInvoiceChatId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Отдельный чат для отправки счетов на оплату. Если не указан, счета отправляются в основной чат.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="procurementChatId">Chat ID группы закупок (необязательно)</Label>
              <Input id="procurementChatId" type="text" placeholder="-1001234567890"
                value={procurementChatId} onChange={(e) => setProcurementChatId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Группа для первичной обработки заявок: назначение исполнителя перед отправкой в основной чат.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadlineChatId">Chat ID для уведомлений по срокам (необязательно)</Label>
              <Input id="deadlineChatId" type="text" placeholder="-1001234567890"
                value={deadlineChatId} onChange={(e) => setDeadlineChatId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Отдельная группа для напоминаний об отгрузке, прибытии и просрочках. Если не указана, уведомления идут в основной чат.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Условия автоматической отправки</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSendOnCreate">При создании заявки</Label>
                <p className="text-xs text-muted-foreground">
                  Автоматически отправлять уведомление при создании новой заявки
                </p>
              </div>
              <Switch id="autoSendOnCreate" checked={autoSendOnCreate} onCheckedChange={setAutoSendOnCreate} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSendOnStatusChange">При изменении статуса</Label>
                <p className="text-xs text-muted-foreground">
                  Автоматически отправлять уведомление при изменении статуса заявки
                </p>
              </div>
              <Switch id="autoSendOnStatusChange" checked={autoSendOnStatusChange} onCheckedChange={setAutoSendOnStatusChange} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSendToProcurement">Отправлять в группу закупок</Label>
                <p className="text-xs text-muted-foreground">
                  Автоматически отправлять новые заявки в группу закупок для назначения исполнителя
                </p>
              </div>
              <Switch id="autoSendToProcurement" checked={autoSendToProcurement} onCheckedChange={setAutoSendToProcurement} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>

          <div className="space-y-2 pt-4 border-t">
            <Label>URL вебхука для Telegram</Label>
            <div className="flex gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copyText(WEBHOOK_URL, "URL вебхука скопирован")}>
                <Webhook className="h-4 w-4 mr-2" />Копировать
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {discovered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="default">Новая группа</Badge>
              Автоматически обнаруженные группы
            </CardTitle>
            <CardDescription>Бот получил сообщения из этих чатов. Привяжите их к организации.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Chat ID</TableHead>
                  <TableHead>Тип чата</TableHead>
                  <TableHead>Последнее сообщение</TableHead>
                  <TableHead>Привязать как</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discovered.map((g) => (
                  <DiscoveredRow key={g.id} g={g} busy={busy} onClaim={claim} onCopy={copyText} onRemove={remove} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Подключённые группы</CardTitle>
              <CardDescription>Группы организации, получающие уведомления из CRM</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Получить ID автоматически
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Группы не привязаны. Добавьте бота в группу и напишите в ней сообщение — она появится в блоке «Автоматически обнаруженные группы» выше.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Chat ID</TableHead>
                  <TableHead>Тип уведомлений</TableHead>
                  <TableHead>Активна</TableHead>
                  <TableHead>Последнее сообщение</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Telegram API</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.group_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <span>{g.group_id}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => copyText(g.group_id, "ID скопирован")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {g.chat_type && <div className="text-[11px] text-muted-foreground mt-0.5">тип: {g.chat_type}</div>}
                    </TableCell>
                    <TableCell>
                      <Select value={g.notification_type} onValueChange={(v) => setType(g, v)}>
                        <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NOTIFICATION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Switch checked={g.is_active} onCheckedChange={() => toggle(g)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground font-numeric">{fmtDate(g.last_message_at)}</TableCell>
                    <TableCell>{webhookBadge(g)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {apiStatusBadge(g)}
                        {g.last_api_at && <div className="text-[11px] text-muted-foreground font-numeric">{fmtDate(g.last_api_at)}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => sendTest(g)} disabled={testing === g.id}>
                          {testing === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Тест</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(g)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние события Telegram</CardTitle>
          <CardDescription>Входящие сообщения и результаты отправок (последние 25)</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Событий пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Время</TableHead>
                  <TableHead>Событие</TableHead>
                  <TableHead>Группа / Chat ID</TableHead>
                  <TableHead>Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-numeric text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                    <TableCell><Badge variant={eventVariant(l.event_type)}>{eventLabel(l.event_type)}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {l.group_name && <div>{l.group_name}</div>}
                      {l.chat_id && <div className="font-mono text-muted-foreground">{l.chat_id}</div>}
                      {!l.group_name && !l.chat_id && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <code className="text-[11px] text-muted-foreground line-clamp-2 break-all">
                        {summarizePayload(l.payload)}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface DiscoveredRowProps {
  g: TgGroup;
  busy: boolean;
  onClaim: (g: TgGroup, type: string) => void;
  onCopy: (text: string, label?: string) => void;
  onRemove: (g: TgGroup) => void;
}

const DiscoveredRow = ({ g, busy, onClaim, onCopy, onRemove }: DiscoveredRowProps) => {
  const [type, setType] = useState<string>("general");
  return (
    <TableRow>
      <TableCell className="font-medium">{g.group_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 font-mono text-xs">
          <span>{g.group_id}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => onCopy(g.group_id, "ID скопирован")}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{g.chat_type || "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground font-numeric">{fmtDate(g.last_message_at)}</TableCell>
      <TableCell>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTIFICATION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => onClaim(g, type)} disabled={busy}>Привязать</Button>
          <Button size="sm" variant="ghost" onClick={() => onRemove(g)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
