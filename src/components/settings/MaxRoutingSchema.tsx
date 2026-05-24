import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, ChevronRight, Clock,
  Eye, Inbox, Loader2, Package, Receipt, RefreshCw, Send, Server, Webhook, XCircle,
} from "lucide-react";

interface Props { organizationId: string; }

interface MaxGroup {
  id: string;
  group_id: string;
  group_name: string;
  notification_type: string;
  is_active: boolean;
  last_api_status: number | null;
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

type TypeKey = "supply" | "invoice" | "request" | "alert";

const TYPE_META: Record<TypeKey, {
  label: string;
  icon: typeof Package;
  color: string;
  sources: { event: string; template: string; trigger: string }[];
}> = {
  supply: {
    label: "Поставка ТМЦ",
    icon: Package,
    color: "text-blue-500",
    sources: [
      { event: "Прибытие груза", trigger: "delivery_date достигнут (cron)", template: "🚚 Груз прибыл" },
      { event: "Изменение статуса доставки", trigger: "status → «В пути / Доставлено в ТК»", template: "📦 Изменение статуса" },
      { event: "Перемещение со склада", trigger: "warehouse_movements INSERT", template: "🔁 Перемещение ТМЦ" },
      { event: "Фото поставки", trigger: "Загружено фото в карточку", template: "🖼 Фото поставки" },
      { event: "Массовая отметка доставки", trigger: "Bulk «Доставлено в ТК»", template: "✅ Партия доставлена" },
    ],
  },
  invoice: {
    label: "Счета на оплату",
    icon: Receipt,
    color: "text-emerald-500",
    sources: [
      { event: "Новый счёт", trigger: "OCR подтверждён", template: "💳 Счёт на оплату" },
      { event: "Согласование счёта", trigger: "payment_status → «На согласовании»", template: "🟡 Требуется согласование" },
      { event: "Оплата выполнена", trigger: "payment_status → «Оплачено»", template: "✅ Счёт оплачен" },
      { event: "Просрочка оплаты", trigger: "due_date < now() (cron)", template: "⚠️ Просрочка оплаты" },
    ],
  },
  request: {
    label: "Входящие заявки",
    icon: Inbox,
    color: "text-violet-500",
    sources: [
      { event: "Новая заявка", trigger: "requests INSERT", template: "🆕 Новая заявка" },
      { event: "Назначен исполнитель", trigger: "executor_id изменён", template: "👤 Назначен ответственный" },
      { event: "Изменение статуса", trigger: "status UPDATE", template: "🔄 Изменение статуса" },
      { event: "Комментарий", trigger: "request_comments INSERT", template: "💬 Новый комментарий" },
      { event: "Отправка на доработку", trigger: "status → «На доработке»", template: "↩️ На доработке" },
    ],
  },
  alert: {
    label: "CRSS Оповещения",
    icon: AlertTriangle,
    color: "text-amber-500",
    sources: [
      { event: "Системная ошибка", trigger: "client_error_logs.severity=critical", template: "🛑 Системная ошибка" },
      { event: "Ошибка webhook", trigger: "max_webhook_logs.outgoing_error", template: "❌ Webhook error" },
      { event: "API alert", trigger: "MAX/Telegram API 4xx/5xx подряд", template: "📡 API alert" },
      { event: "Действия пользователей", trigger: "audit_logs критичных действий", template: "👁 Действие пользователя" },
      { event: "Ежедневная сводка", trigger: "cron daily-summary", template: "📊 Daily digest" },
    ],
  },
};

const PREVIEW: Record<TypeKey, string> = {
  supply: "🚚 Груз прибыл\nЗаявка: REQ-1043\nОбъект: Склад «Северный»\nПоставщик: ООО «МеталлТорг»\nСумма: 142 500 ₽",
  invoice: "💳 Новый счёт\nПоставщик: ООО «СтройКомплект»\nНомер: СЧ-2026/118\nСумма: 84 320 ₽\nСрок: 28.05.2026",
  request: "🆕 Новая заявка\n#REQ-1098 · Высокий\nЗаявитель: А. Петров\nОбъект: БЦ Аврора (ремонт)\nОписание: Замена насоса циркуляции",
  alert: "🛑 CRSS Alert\nMAX API: 401 Unauthorized (3 подряд)\nГруппа: -75086536078021\nВремя: 23:14",
};

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" }) : "—";

const eventLabel = (t: string | null) => ({
  incoming_raw: "Входящий webhook", outgoing_ok: "Отправлено", outgoing_error: "Ошибка отправки",
  "api_response:bearer": "MAX API (bearer)", "api_response:query": "MAX API (query)",
  bot_added: "Бот добавлен", message_created: "Сообщение", message_callback: "Callback",
} as Record<string, string>)[t || ""] || t || "—";

function statusTone(l: WebhookLog): "ok" | "wait" | "err" {
  const t = l.event_type || "";
  const code = l.payload?.status;
  if (t.includes("error") || (typeof code === "number" && code >= 400)) return "err";
  if (t === "outgoing_ok" || (typeof code === "number" && code >= 200 && code < 300)) return "ok";
  return "wait";
}

const toneDot: Record<"ok" | "wait" | "err", string> = {
  ok: "bg-emerald-500", wait: "bg-amber-500", err: "bg-destructive",
};

export const MaxRoutingSchema = ({ organizationId }: Props) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<MaxGroup[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState<TypeKey | null>(null);
  const [openLog, setOpenLog] = useState<WebhookLog | null>(null);

  const load = async () => {
    const [g, l] = await Promise.all([
      supabase.from("max_groups" as any).select("*")
        .eq("organization_id", organizationId).order("notification_type"),
      supabase.from("max_webhook_logs" as any).select("*")
        .order("created_at", { ascending: false }).limit(30),
    ]);
    setGroups((g.data || []) as any);
    setLogs((l.data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const refresh = async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  };

  const byType = useMemo(() => {
    const m: Record<TypeKey, MaxGroup[]> = { supply: [], invoice: [], request: [], alert: [] };
    groups.forEach((g) => { if (g.notification_type in m) m[g.notification_type as TypeKey].push(g); });
    return m;
  }, [groups]);

  const toggleType = async (type: TypeKey, on: boolean) => {
    const ids = byType[type].map((g) => g.id);
    if (!ids.length) return;
    const { error } = await supabase.from("max_groups" as any).update({ is_active: on }).in("id", ids);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else load();
  };

  const testSend = async (type: TypeKey) => {
    if (!byType[type].length) {
      toast({ title: "Нет группы", description: `Для «${TYPE_META[type].label}» не привязана группа`, variant: "destructive" });
      return;
    }
    setTesting(type);
    const { data, error } = await supabase.functions.invoke("notify-max", {
      body: { organization_id: organizationId, notification_type: type, text: PREVIEW[type] },
    });
    setTesting(null);
    if (error || (data as any)?.ok === false) {
      toast({ title: "Не отправлено", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      toast({ title: "Отправлено", description: `${TYPE_META[type].label} → ${(data as any)?.sent || 1} гр.` });
    }
    load();
  };

  return (
    <div className="space-y-6">
      {/* Visual route */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Маршрут уведомления</CardTitle>
          <CardDescription>Как событие из CRM долетает до группы в MAX</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RouteNode icon={Activity} label="Событие CRM" sub="trigger / cron" tone="violet" />
            <Arrow />
            <RouteNode icon={Server} label="notify-max" sub="edge function" tone="blue" />
            <Arrow />
            <RouteNode icon={Webhook} label="platform-api.max.ru" sub="POST /messages" tone="amber" />
            <Arrow />
            <RouteNode icon={Bot} label="Группа MAX" sub="по типу уведомления" tone="emerald" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend tone="ok" label="успешно" />
            <Legend tone="wait" label="ожидание / отправляется" />
            <Legend tone="err" label="ошибка доставки" />
          </div>
        </CardContent>
      </Card>

      {/* What goes where + controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Что куда отправляется</CardTitle>
              <CardDescription>Выключатель, тестовая отправка и превью для каждого типа</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(Object.keys(TYPE_META) as TypeKey[]).map((t) => {
            const meta = TYPE_META[t];
            const gs = byType[t];
            const anyOn = gs.some((g) => g.is_active);
            const Icon = meta.icon;
            const lastStatus = gs.find((g) => g.last_api_status != null)?.last_api_status ?? null;
            const tone: "ok" | "wait" | "err" = lastStatus == null
              ? "wait" : lastStatus >= 200 && lastStatus < 300 ? "ok" : "err";
            return (
              <div key={t} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    <div>
                      <div className="font-semibold">{meta.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{t}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${toneDot[tone]}`} />
                    <Switch
                      checked={anyOn}
                      disabled={!gs.length}
                      onCheckedChange={(v) => toggleType(t, v)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {gs.length === 0 ? (
                    <Badge variant="outline">Группа не привязана</Badge>
                  ) : gs.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <div className="truncate">{g.group_name}</div>
                      <span className="font-mono text-[11px] text-muted-foreground ml-2 shrink-0">
                        {g.group_id}
                      </span>
                    </div>
                  ))}
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    Источники событий ({meta.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {meta.sources.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium">{s.event}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {s.trigger} · шаблон: <span className="font-mono">{s.template}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                    Предпросмотр сообщения
                  </summary>
                  <pre className="mt-2 p-3 rounded bg-muted text-xs whitespace-pre-wrap font-mono">
                    {PREVIEW[t]}
                  </pre>
                </details>

                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => testSend(t)} disabled={testing === t || !gs.length}>
                    {testing === t ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Тест в группу
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Routing matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Полная матрица маршрутов</CardTitle>
          <CardDescription>Событие → триггер → группа → шаблон сообщения</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Источник события</TableHead>
                <TableHead>Триггер</TableHead>
                <TableHead>Группа MAX</TableHead>
                <TableHead>Шаблон</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.keys(TYPE_META) as TypeKey[]).flatMap((t) =>
                TYPE_META[t].sources.map((s, i) => {
                  const gs = byType[t];
                  return (
                    <TableRow key={`${t}-${i}`}>
                      <TableCell>
                        <div className="font-medium">{s.event}</div>
                        <div className="text-[11px] text-muted-foreground">{TYPE_META[t].label}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.trigger}</TableCell>
                      <TableCell>
                        {gs.length === 0 ? (
                          <Badge variant="outline">Не привязана</Badge>
                        ) : gs.map((g) => (
                          <div key={g.id} className="text-xs">
                            {g.group_name}
                            <div className="font-mono text-[11px] text-muted-foreground">{g.group_id}</div>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{s.template}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Live logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Live-логи MAX
          </CardTitle>
          <CardDescription>Последние 30 событий — нажмите «Полный путь» для деталей</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Событий пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[150px]">Время</TableHead>
                  <TableHead>Событие</TableHead>
                  <TableHead>Группа / Chat ID</TableHead>
                  <TableHead>Текст / ответ MAX</TableHead>
                  <TableHead className="text-right">Путь</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => {
                  const tone = statusTone(l);
                  const code = l.payload?.status;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`block h-2.5 w-2.5 rounded-full ${toneDot[tone]}`} />
                            </TooltipTrigger>
                            <TooltipContent>{tone === "ok" ? "Успешно" : tone === "err" ? "Ошибка" : "Ожидание"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs font-numeric text-muted-foreground">{fmt(l.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={tone === "err" ? "destructive" : tone === "ok" ? "default" : "secondary"}>
                          {eventLabel(l.event_type)}
                        </Badge>
                        {typeof code === "number" && (
                          <span className="ml-2 text-[11px] font-mono text-muted-foreground">HTTP {code}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.group_name && <div>{l.group_name}</div>}
                        {l.chat_id && <div className="font-mono text-muted-foreground">{l.chat_id}</div>}
                        {!l.group_name && !l.chat_id && <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <code className="text-[11px] text-muted-foreground line-clamp-2 break-all">
                          {summary(l.payload)}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setOpenLog(l)}>
                          <Eye className="h-4 w-4 mr-1" /> Полный путь
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Full path dialog */}
      <Dialog open={!!openLog} onOpenChange={(o) => !o && setOpenLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Полный путь уведомления</DialogTitle>
            <DialogDescription>{openLog && fmt(openLog.created_at)} · {openLog && eventLabel(openLog.event_type)}</DialogDescription>
          </DialogHeader>
          {openLog && (
            <div className="space-y-4 text-sm">
              <PathStep n={1} title="Источник" body={
                openLog.event_type?.startsWith("outgoing")
                  ? "CRM-событие → notify-max (исходящее)"
                  : "Входящее обновление от MAX (webhook)"
              } />
              <PathStep n={2} title="Payload" body={
                <pre className="p-2 rounded bg-muted text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                  {JSON.stringify(openLog.payload, null, 2)}
                </pre>
              } />
              <PathStep n={3} title="MAX API" body={
                openLog.payload?.status
                  ? `HTTP ${openLog.payload.status} · ${String(openLog.payload.response || "").slice(0, 200)}`
                  : "—"
              } />
              <PathStep n={4} title="Группа" body={
                <span className="font-mono">{openLog.chat_id || openLog.group_id || "—"} {openLog.group_name && `· ${openLog.group_name}`}</span>
              } />
              <PathStep n={5} title="Статус доставки" body={
                <Badge variant={statusTone(openLog) === "err" ? "destructive" : statusTone(openLog) === "ok" ? "default" : "secondary"}>
                  {statusTone(openLog) === "ok" ? <CheckCircle2 className="h-3 w-3 mr-1" />
                    : statusTone(openLog) === "err" ? <XCircle className="h-3 w-3 mr-1" />
                    : <Clock className="h-3 w-3 mr-1" />}
                  {statusTone(openLog) === "ok" ? "Доставлено" : statusTone(openLog) === "err" ? "Ошибка" : "В процессе"}
                </Badge>
              } />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function summary(p: any) {
  if (!p) return "";
  if (typeof p === "string") return p.slice(0, 200);
  if (p.text) return `«${String(p.text).slice(0, 160)}»${p.response ? " → " + String(p.response).slice(0, 80) : ""}`;
  if (p.status) return `status ${p.status} · ${JSON.stringify(p.response || "").slice(0, 160)}`;
  if (p.message?.body?.text) return `«${p.message.body.text}»`;
  return JSON.stringify(p).slice(0, 200);
}

const TONE_BG: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/30",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
};

const RouteNode = ({ icon: Icon, label, sub, tone }: {
  icon: typeof Activity; label: string; sub: string; tone: keyof typeof TONE_BG;
}) => (
  <div className={`flex-1 min-w-[150px] rounded-lg border p-3 text-center ${TONE_BG[tone]}`}>
    <Icon className="h-5 w-5 mx-auto mb-1" />
    <div className="font-semibold text-sm">{label}</div>
    <div className="text-[11px] opacity-70 font-mono">{sub}</div>
  </div>
);

const Arrow = () => (
  <div className="flex items-center justify-center text-muted-foreground shrink-0">
    <ArrowRight className="h-5 w-5" />
  </div>
);

const Legend = ({ tone, label }: { tone: "ok" | "wait" | "err"; label: string }) => (
  <div className="flex items-center gap-1.5">
    <span className={`h-2 w-2 rounded-full ${toneDot[tone]}`} />
    <span>{label}</span>
  </div>
);

const PathStep = ({ n, title, body }: { n: number; title: string; body: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
      {n}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm mb-1">{title}</div>
      <div className="text-sm text-muted-foreground">{body}</div>
    </div>
  </div>
);
