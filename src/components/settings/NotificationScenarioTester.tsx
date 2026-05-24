import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, Receipt, PackageCheck, MoveRight, RefreshCw, AlertTriangle,
  MessageSquare, UserPlus, Bug, Webhook, Play, ListChecks, Eye, Loader2,
  CheckCircle2, XCircle, Clock, ArrowRight, Send, Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Platform = "max" | "telegram";
type NotificationType = "request" | "invoice" | "supply" | "alert";

interface Scenario {
  id: string;
  title: string;
  source: string;
  trigger: string;
  notification_type: NotificationType;
  icon: any;
  template: (orgName: string) => string;
}

interface GroupRow {
  id: string;
  group_id: string;
  group_name: string;
  notification_type: string;
  is_active: boolean;
}

interface TestResult {
  scenario_id: string;
  platform: Platform;
  group_id: string;
  group_name: string;
  ok: boolean;
  status: number | null;
  response: any;
  text: string;
  at: string;
  who: string | null;
  simulated: boolean;
  error?: string;
}

const now = () => new Date().toLocaleString("ru-RU");

const SCENARIOS: Scenario[] = [
  {
    id: "new_request", title: "Новая заявка", source: "requests (INSERT)",
    trigger: "Создание заявки в CRM", notification_type: "request", icon: FileText,
    template: (org) => `🆕 <b>Новая заявка</b>\nОрганизация: ${org}\nЗаявитель: Тестовый пользователь\nОбъект: Тестовый объект\nОписание: Тестовая позиция × 5 шт.`,
  },
  {
    id: "new_invoice", title: "Новый счёт", source: "requests.invoice_number (OCR)",
    trigger: "Загрузка счёта через OCR", notification_type: "invoice", icon: Receipt,
    template: (org) => `💰 <b>Новый счёт</b>\nОрганизация: ${org}\nПоставщик: ООО «Тест»\n№ счёта: TEST-001\nСумма: 12 500,00 ₽`,
  },
  {
    id: "tmc_arrival", title: "Приход ТМЦ", source: "requests.status = 'Доставлено'",
    trigger: "Подтверждение приёмки на складе", notification_type: "supply", icon: PackageCheck,
    template: (org) => `📦 <b>Приход ТМЦ</b>\nОрганизация: ${org}\nЗаявка: #TEST-001\nСклад: Основной\nКоличество: 5 шт.`,
  },
  {
    id: "stock_move", title: "Перемещение груза", source: "stock_movements (MOVE_OUT/MOVE_IN)",
    trigger: "Создание движения между складами", notification_type: "supply", icon: MoveRight,
    template: (org) => `🔁 <b>Перемещение ТМЦ</b>\nОрганизация: ${org}\nС: Склад А → На: Склад Б\nПозиция: Тестовый материал × 3 шт.`,
  },
  {
    id: "status_change", title: "Изменение статуса", source: "requests.status (UPDATE)",
    trigger: "Любое изменение статуса заявки", notification_type: "request", icon: RefreshCw,
    template: (org) => `🔄 <b>Статус заявки изменён</b>\nОрганизация: ${org}\nЗаявка: #TEST-001\nСтатус: «В работе» → «Доставлено в ТК»`,
  },
  {
    id: "overdue_payment", title: "Просрочка оплаты", source: "requests.payment_status",
    trigger: "Дедлайн оплаты прошёл, оплата не выполнена", notification_type: "invoice", icon: AlertTriangle,
    template: (org) => `⏰ <b>Просрочка оплаты</b>\nОрганизация: ${org}\nСчёт: TEST-001 на 12 500,00 ₽\nПросрочка: 3 дн.`,
  },
  {
    id: "new_comment", title: "Новый комментарий", source: "request_comments (INSERT)",
    trigger: "Пользователь оставил комментарий", notification_type: "request", icon: MessageSquare,
    template: (org) => `💬 <b>Новый комментарий</b>\nОрганизация: ${org}\nЗаявка: #TEST-001\nАвтор: Тестовый пользователь\n«Проверьте, пожалуйста, спецификацию».`,
  },
  {
    id: "executor_assigned", title: "Назначение ответственного", source: "requests.executor (UPDATE)",
    trigger: "Назначен/изменён исполнитель", notification_type: "request", icon: UserPlus,
    template: (org) => `👤 <b>Назначен ответственный</b>\nОрганизация: ${org}\nЗаявка: #TEST-001\nИсполнитель: Иванов И.И.`,
  },
  {
    id: "system_error", title: "Системная ошибка CRM", source: "audit_logs / runtime",
    trigger: "Необработанное исключение в edge-функции", notification_type: "alert", icon: Bug,
    template: (org) => `🛑 <b>Системная ошибка CRM</b>\nОрганизация: ${org}\nFunction: notify-max\nError: Test runtime exception\nTime: ${now()}`,
  },
  {
    id: "webhook_error", title: "Webhook error", source: "max_webhook_logs / telegram_webhook_logs",
    trigger: "Ошибка доставки webhook", notification_type: "alert", icon: Webhook,
    template: (org) => `⚠️ <b>Webhook error</b>\nОрганизация: ${org}\nProvider: MAX / Telegram\nStatus: 401 Unauthorized\nTime: ${now()}`,
  },
];

interface Props { organizationId: string; orgName?: string }

export function NotificationScenarioTester({ organizationId, orgName = "Моя организация" }: Props) {
  const { toast } = useToast();
  const [maxGroups, setMaxGroups] = useState<GroupRow[]>([]);
  const [tgGroups, setTgGroups] = useState<GroupRow[]>([]);
  const [simulate, setSimulate] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [previewScenario, setPreviewScenario] = useState<Scenario | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.email ?? user?.id ?? null);
      await loadGroups();
    })();
  }, [organizationId]);

  const loadGroups = async () => {
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from("max_groups").select("id,group_id,group_name,notification_type,is_active")
        .eq("organization_id", organizationId),
      supabase.from("telegram_groups").select("id,group_id,group_name,notification_type,is_active")
        .eq("organization_id", organizationId),
    ]);
    setMaxGroups((m ?? []) as GroupRow[]);
    setTgGroups((t ?? []) as GroupRow[]);
  };

  const routeFor = (s: Scenario) => ({
    max: maxGroups.filter(g => g.is_active && g.notification_type === s.notification_type),
    telegram: tgGroups.filter(g => g.is_active && g.notification_type === s.notification_type),
  });

  const sendOne = async (s: Scenario, platform: Platform, group: GroupRow): Promise<TestResult> => {
    const text = s.template(orgName);
    const at = new Date().toISOString();
    const base: TestResult = {
      scenario_id: s.id, platform, group_id: group.group_id, group_name: group.group_name,
      ok: false, status: null, response: null, text, at, who: me, simulated: simulate,
    };
    if (simulate) return { ...base, ok: true, status: 0, response: { simulated: true } };
    try {
      const fn = platform === "max" ? "notify-max" : "telegram-debug-send";
      const body: any = platform === "max"
        ? { organization_id: organizationId, group_id: group.group_id, text }
        : { organization_id: organizationId, chat_id: group.group_id, text };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) return { ...base, error: error.message };
      return {
        ...base,
        ok: data?.ok !== false,
        status: data?.status ?? (data?.ok ? 200 : 500),
        response: data,
      };
    } catch (e: any) {
      return { ...base, error: e.message };
    }
  };

  const runScenario = async (s: Scenario) => {
    setBusy(s.id);
    const route = routeFor(s);
    const targets: { platform: Platform; group: GroupRow }[] = [
      ...route.max.map(g => ({ platform: "max" as Platform, group: g })),
      ...route.telegram.map(g => ({ platform: "telegram" as Platform, group: g })),
    ];
    if (targets.length === 0) {
      toast({
        title: "Нет групп для этого типа",
        description: `Назначьте хотя бы одну группу типа «${s.notification_type}»`,
        variant: "destructive",
      });
      setBusy(null);
      return;
    }
    const out: TestResult[] = [];
    for (const t of targets) out.push(await sendOne(s, t.platform, t.group));
    setResults(r => [...out, ...r].slice(0, 200));
    setBusy(null);
    toast({
      title: simulate ? "Симуляция выполнена" : "Отправка завершена",
      description: `${s.title}: ${out.filter(r => r.ok).length}/${out.length} ОК`,
    });
  };

  const runAll = async () => {
    setBusy("__all__");
    const collected: TestResult[] = [];
    for (const s of SCENARIOS) {
      const route = routeFor(s);
      const targets: { platform: Platform; group: GroupRow }[] = [
        ...route.max.map(g => ({ platform: "max" as Platform, group: g })),
        ...route.telegram.map(g => ({ platform: "telegram" as Platform, group: g })),
      ];
      if (targets.length === 0) {
        collected.push({
          scenario_id: s.id, platform: "max", group_id: "—", group_name: "(нет групп)",
          ok: false, status: null, response: null, text: s.template(orgName),
          at: new Date().toISOString(), who: me, simulated: simulate,
          error: `Не назначены группы типа «${s.notification_type}»`,
        });
        continue;
      }
      for (const t of targets) collected.push(await sendOne(s, t.platform, t.group));
    }
    setResults(r => [...collected, ...r].slice(0, 300));
    setBusy(null);
    const ok = collected.filter(r => r.ok).length;
    toast({
      title: "Полная проверка завершена",
      description: `${ok}/${collected.length} успешно`,
      variant: ok === collected.length ? "default" : "destructive",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" /> Тест логики уведомлений
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Прогоните сценарии CRM и посмотрите, в какие группы MAX/Telegram уйдут сообщения.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="sim" checked={simulate} onCheckedChange={setSimulate} />
              <Label htmlFor="sim" className="text-sm">
                {simulate ? "Только симуляция" : "Реальная отправка"}
              </Label>
            </div>
            <Button onClick={runAll} disabled={!!busy} size="sm">
              {busy === "__all__" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />}
              Проверить всю схему
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIOS.map(s => {
            const route = routeFor(s);
            const total = route.max.length + route.telegram.length;
            const Icon = s.icon;
            return (
              <div key={s.id} className="rounded-lg border p-3 flex flex-col gap-2 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.trigger}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{s.notification_type}</Badge>
                </div>

                <div className="text-xs space-y-1 mt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-muted-foreground">MAX:</span>
                    {route.max.length === 0 ? <span className="text-destructive">нет</span>
                      : route.max.map(g => <Badge key={g.id} variant="secondary" className="text-[10px]">{g.group_name}</Badge>)}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-muted-foreground">TG:</span>
                    {route.telegram.length === 0 ? <span className="text-destructive">нет</span>
                      : route.telegram.map(g => <Badge key={g.id} variant="secondary" className="text-[10px]">{g.group_name}</Badge>)}
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-8"
                    onClick={() => setPreviewScenario(s)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Предпросмотр
                  </Button>
                  <Button size="sm" className="flex-1 h-8"
                    disabled={busy === s.id || total === 0}
                    onClick={() => runScenario(s)}>
                    {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      : simulate ? <Play className="h-3.5 w-3.5 mr-1" />
                      : <Send className="h-3.5 w-3.5 mr-1" />}
                    {simulate ? "Симуляция" : "Отправить"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Результаты ({results.length})</h4>
            {results.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setResults([])}>Очистить</Button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border rounded-md">
              Запустите сценарий — здесь появится цепочка: Источник → Логика → Шаблон → MAX/Telegram → Группа.
            </div>
          ) : (
            <ScrollArea className="h-[380px] border rounded-md">
              <div className="divide-y">
                {results.map((r, i) => {
                  const s = SCENARIOS.find(x => x.id === r.scenario_id)!;
                  return (
                    <div key={i} className="p-3 text-sm space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                          : <XCircle className="h-4 w-4 text-destructive" />}
                        <span className="font-medium">{s.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{r.platform}</Badge>
                        {r.simulated && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">simulated</Badge>}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{new Date(r.at).toLocaleTimeString("ru-RU")}
                        </span>
                        {r.who && <span className="text-xs text-muted-foreground">· {r.who}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                        <span>{s.source}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>тип «{s.notification_type}»</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{r.platform === "max" ? "notify-max" : "telegram-debug-send"}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{r.group_name} ({r.group_id})</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{r.text}</div>
                        <div className="text-xs bg-muted/40 rounded p-2 font-mono overflow-x-auto">
                          <div>status: <span className={cn(r.ok ? "text-green-600" : "text-destructive")}>{r.status ?? "—"}</span></div>
                          {r.error && <div className="text-destructive">error: {r.error}</div>}
                          {r.response && (
                            <pre className="mt-1 whitespace-pre-wrap break-all">
                              {JSON.stringify(r.response, null, 2).slice(0, 600)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      <Dialog open={!!previewScenario} onOpenChange={(o) => !o && setPreviewScenario(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предпросмотр: {previewScenario?.title}</DialogTitle>
          </DialogHeader>
          {previewScenario && (
            <div className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground">
                <div><b>Источник:</b> {previewScenario.source}</div>
                <div><b>Триггер:</b> {previewScenario.trigger}</div>
                <div><b>Тип:</b> {previewScenario.notification_type}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: previewScenario.template(orgName) }} />
              <div className="text-xs">
                <div className="font-medium mb-1">Маршрут:</div>
                {(() => {
                  const r = routeFor(previewScenario);
                  if (r.max.length + r.telegram.length === 0)
                    return <div className="text-destructive">Нет назначенных групп.</div>;
                  return (
                    <ul className="list-disc ml-4 space-y-0.5">
                      {r.max.map(g => <li key={"m"+g.id}>MAX → {g.group_name} ({g.group_id})</li>)}
                      {r.telegram.map(g => <li key={"t"+g.id}>Telegram → {g.group_name} ({g.group_id})</li>)}
                    </ul>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
