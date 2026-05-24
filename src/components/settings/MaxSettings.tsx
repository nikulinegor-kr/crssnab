import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, CheckCircle2, Copy, Info, Loader2, RefreshCw, Send, Trash2, Webhook, XCircle, AlertCircle,
} from "lucide-react";

interface MaxSettingsProps {
  organizationId: string;
}

const NOTIFICATION_TYPES = [
  { value: "supply", label: "Поставка ТМЦ" },
  { value: "invoice", label: "Счета на оплату" },
  { value: "request", label: "Входящие заявки" },
  { value: "alert", label: "CRSS оповещения" },
] as const;

interface MaxGroup {
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

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/max-webhook`;

const labelForType = (v: string) => NOTIFICATION_TYPES.find((t) => t.value === v)?.label || v;

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
};

const eventLabel = (t: string | null) => {
  const map: Record<string, string> = {
    incoming_raw: "Входящий webhook",
    "api_response:bearer": "MAX API (bearer)",
    "api_response:query": "MAX API (query)",
    outgoing_ok: "Отправлено ✓",
    outgoing_error: "Ошибка отправки",
    bot_added: "Бот добавлен",
    message_created: "Сообщение",
    message_callback: "Callback",
  };
  return map[t || ""] || t || "—";
};

const eventVariant = (t: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!t) return "outline";
  if (t.startsWith("outgoing_error") || t.includes("error")) return "destructive";
  if (t === "outgoing_ok") return "default";
  if (t.startsWith("api_response")) return "secondary";
  return "outline";
};

export const MaxSettings = ({ organizationId }: MaxSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<MaxGroup[]>([]);
  const [discovered, setDiscovered] = useState<MaxGroup[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [orgRes, discRes, logsRes] = await Promise.all([
      supabase.from("max_groups" as any)
        .select("*").eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase.from("max_groups" as any)
        .select("*").is("organization_id", null)
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase.from("max_webhook_logs" as any)
        .select("*").order("created_at", { ascending: false }).limit(25),
    ]);
    if (orgRes.error) toast({ title: "Ошибка", description: orgRes.error.message, variant: "destructive" });
    setGroups((orgRes.data || []) as any);
    setDiscovered((discRes.data || []) as any);
    setLogs((logsRes.data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    toast({ title: "Обновлено", description: "Список групп и событий обновлён" });
  };

  const claim = async (g: MaxGroup, type: string) => {
    setBusy(true);
    const { error } = await supabase.from("max_groups" as any)
      .update({ organization_id: organizationId, notification_type: type, is_discovered: false })
      .eq("id", g.id);
    setBusy(false);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else { toast({ title: "Группа привязана" }); load(); }
  };

  const setType = async (g: MaxGroup, type: string) => {
    const { error } = await supabase.from("max_groups" as any)
      .update({ notification_type: type }).eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else load();
  };

  const toggle = async (g: MaxGroup) => {
    const { error } = await supabase.from("max_groups" as any)
      .update({ is_active: !g.is_active }).eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (g: MaxGroup) => {
    if (!confirm(`Удалить группу «${g.group_name}»?`)) return;
    const { error } = await supabase.from("max_groups" as any).delete().eq("id", g.id);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else load();
  };

  const sendTest = async (g: MaxGroup) => {
    setTesting(g.id);
    const { data, error } = await supabase.functions.invoke("notify-max", {
      body: {
        organization_id: organizationId,
        group_id: g.group_id,
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
    load();
  };

  const copyText = async (text: string, label = "Скопировано") => {
    await navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const apiStatusBadge = (g: MaxGroup) => {
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

  const webhookBadge = (g: MaxGroup) => {
    if (!g.last_message_at) {
      return <Badge variant="outline">Нет сообщений</Badge>;
    }
    const ageH = (Date.now() - new Date(g.last_message_at).getTime()) / 3.6e6;
    if (ageH < 24) return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Активен</Badge>;
    return <Badge variant="secondary">Тихо {Math.floor(ageH / 24)}д</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>MAX бот (max.ru)</CardTitle>
                <CardDescription>Уведомления в мессенджер MAX параллельно с Telegram</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Получить ID автоматически
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm space-y-2">
              <p className="font-semibold">Как получить ID группы автоматически:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Добавьте бота в нужную группу MAX.</li>
                <li>Напишите в группе любое сообщение (или команду <code className="bg-muted px-1 rounded">/id</code>).</li>
                <li>Группа появится ниже с пометкой «Новая группа» — выберите тип уведомлений и привяжите её к организации.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>URL вебхука для MAX</Label>
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
            <CardDescription>Бот получил сообщения из этих групп. Привяжите их к вашей организации.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Group ID</TableHead>
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
          <CardTitle className="text-base">Подключённые группы</CardTitle>
          <CardDescription>Группы организации, получающие уведомления из CRM</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Группы не привязаны. Добавьте бота в группу и напишите в ней сообщение — она появится в блоке выше.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Group ID / Chat ID</TableHead>
                  <TableHead>Тип уведомлений</TableHead>
                  <TableHead>Активна</TableHead>
                  <TableHead>Последнее сообщение</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>MAX API</TableHead>
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
          <CardTitle className="text-base">Последние события MAX</CardTitle>
          <CardDescription>Входящие сообщения, ответы MAX API и результаты отправок (последние 25)</CardDescription>
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

function summarizePayload(p: any): string {
  if (!p) return "";
  if (typeof p === "string") return p.slice(0, 200);
  if (p.status) return `status: ${p.status}${p.response ? " · " + JSON.stringify(p.response).slice(0, 140) : ""}`;
  if (p.message?.body?.text) return `«${p.message.body.text}»`;
  if (p.text) return `«${String(p.text).slice(0, 200)}»`;
  return JSON.stringify(p).slice(0, 200);
}

const DiscoveredRow = ({
  g, busy, onClaim, onCopy, onRemove,
}: {
  g: MaxGroup;
  busy: boolean;
  onClaim: (g: MaxGroup, type: string) => void;
  onCopy: (text: string, label?: string) => void;
  onRemove: (g: MaxGroup) => void;
}) => {
  const [type, setType] = useState<string>("supply");
  return (
    <TableRow>
      <TableCell className="font-medium">{g.group_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 font-mono text-xs">
          <span>{g.group_id}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopy(g.group_id, "ID скопирован")}>
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
