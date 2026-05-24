// Production notifications control panel: mode switch, routing rules, live monitoring, queue journal, health.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Zap, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface Props {
  organizationId: string;
}

type Mode = "test" | "production";
type Settings = {
  organization_id: string;
  mode: Mode;
  dedup_window_seconds: number;
  max_per_minute: number;
};

type Rule = {
  id: string;
  event_type: string;
  notification_type: string;
  is_enabled: boolean;
  description: string | null;
};

type QueueRow = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  platform: "max" | "telegram";
  group_id: string;
  group_name: string | null;
  payload: any;
  status: string;
  retry_count: number;
  last_http_code: number | null;
  last_error: string | null;
  last_response: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
};

type Health = {
  component: string;
  status: "ok" | "degraded" | "down" | "unknown";
  last_check_at: string;
  last_error: string | null;
  latency_ms: number | null;
};

const NOTIFICATION_TYPES = ["incoming", "request", "invoice", "supply", "alert", "general"];

export const ProductionNotificationsPanel = ({ organizationId }: Props) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const loadAll = async () => {
    setLoading(true);
    const [s, r, q, h] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
      supabase.from("notification_routing_rules").select("*").eq("organization_id", organizationId).order("event_type"),
      supabase.from("notification_queue").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
      supabase.from("notification_health").select("*").or(`organization_id.eq.${organizationId},organization_id.is.null`).order("component"),
    ]);

    if (s.data) {
      setSettings(s.data as Settings);
    } else {
      // seed
      await supabase.from("notification_settings").insert({ organization_id: organizationId });
      const { data } = await supabase.from("notification_settings").select("*").eq("organization_id", organizationId).maybeSingle();
      if (data) setSettings(data as Settings);
    }
    if (r.data) setRules(r.data as Rule[]);
    if (q.data) setQueue(q.data as QueueRow[]);
    if (h.data) setHealth(h.data as Health[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel(`notification_queue_${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_queue", filter: `organization_id=eq.${organizationId}` },
        () => {
          supabase
            .from("notification_queue")
            .select("*")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(100)
            .then(({ data }) => data && setQueue(data as QueueRow[]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const setMode = async (mode: Mode) => {
    if (!settings) return;
    setSavingMode(true);
    const { error } = await supabase
      .from("notification_settings")
      .update({ mode, updated_by: (await supabase.auth.getUser()).data.user?.id })
      .eq("organization_id", organizationId);
    setSavingMode(false);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, mode });
    toast.success(mode === "production" ? "Включён рабочий режим" : "Включён тестовый режим");
  };

  const updateRule = async (id: string, patch: Partial<Rule>) => {
    const { error } = await supabase.from("notification_routing_rules").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    const { error } = await supabase.functions.invoke("notification-health", {
      body: { organization_id: organizationId },
    });
    setCheckingHealth(false);
    if (error) return toast.error(error.message);
    toast.success("Health-check выполнен");
    const { data } = await supabase
      .from("notification_health")
      .select("*")
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("component");
    if (data) setHealth(data as Health[]);
  };

  const retryItem = async (id: string) => {
    const { error } = await supabase
      .from("notification_queue")
      .update({
        status: "queued",
        retry_count: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    supabase.functions.invoke("notification-worker", { body: {} });
    toast.success("Поставлено в очередь повторно");
  };

  const triggerWorker = async () => {
    const { data, error } = await supabase.functions.invoke("notification-worker", { body: {} });
    if (error) return toast.error(error.message);
    toast.success(`Воркер: обработано ${(data as any)?.processed ?? 0}`);
  };

  const stats = useMemo(() => {
    const last24h = queue.filter(
      (q) => new Date(q.created_at).getTime() > Date.now() - 24 * 3600 * 1000,
    );
    return {
      total: last24h.length,
      delivered: last24h.filter((q) => q.status === "delivered").length,
      queued: last24h.filter((q) => q.status === "queued" || q.status === "sending").length,
      failed: last24h.filter((q) => q.status === "failed").length,
      skipped: last24h.filter((q) => q.status === "skipped").length,
    };
  }, [queue]);

  const filteredQueue = queue.filter(
    (q) =>
      (statusFilter === "all" || q.status === statusFilter) &&
      (platformFilter === "all" || q.platform === platformFilter),
  );

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      queued: { label: "В очереди", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
      sending: { label: "Отправка", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
      delivered: { label: "Доставлено", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
      failed: { label: "Ошибка", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
      skipped: { label: "Тест", cls: "bg-muted text-muted-foreground" },
    };
    const m = map[s] ?? { label: s, cls: "bg-muted text-muted-foreground" };
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  const healthDot = (status: string) => {
    const colors: Record<string, string> = {
      ok: "bg-emerald-500",
      degraded: "bg-amber-500",
      down: "bg-red-500",
      unknown: "bg-muted",
    };
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] ?? "bg-muted"}`} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* MODE SWITCH */}
      <Card className={settings?.mode === "production" ? "border-emerald-500/50" : "border-amber-500/50"}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Режим уведомлений
              </CardTitle>
              <CardDescription>
                {settings?.mode === "production"
                  ? "🟢 РАБОЧИЙ: CRM автоматически отправляет уведомления по реальным событиям"
                  : "🟡 ТЕСТОВЫЙ: события логируются в очередь, но не отправляются"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="mode-switch" className="text-sm">
                {settings?.mode === "production" ? "Production" : "Тестовый"}
              </Label>
              <Switch
                id="mode-switch"
                checked={settings?.mode === "production"}
                disabled={savingMode}
                onCheckedChange={(v) => setMode(v ? "production" : "test")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          {["max_api", "telegram_api", "edge_functions"].map((c) => {
            const h = health.find((x) => x.component === c);
            const labels: Record<string, string> = {
              max_api: "MAX API",
              telegram_api: "Telegram API",
              edge_functions: "Edge functions",
            };
            return (
              <div key={c} className="flex items-center gap-2">
                {healthDot(h?.status ?? "unknown")}
                <span className="text-muted-foreground">{labels[c]}</span>
                {h?.latency_ms ? <span className="text-xs text-muted-foreground">{h.latency_ms}ms</span> : null}
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={runHealthCheck}
            disabled={checkingHealth}
            className="ml-auto"
          >
            {checkingHealth ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Activity className="h-3.5 w-3.5 mr-1.5" />}
            Проверить сейчас
          </Button>
          <Button size="sm" variant="outline" onClick={triggerWorker}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Запустить воркер
          </Button>
        </CardContent>
      </Card>

      {/* LIVE MONITORING */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live monitoring · последние 24 часа</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Всего", value: stats.total, cls: "" },
              { label: "Доставлено", value: stats.delivered, cls: "text-emerald-600 dark:text-emerald-400" },
              { label: "В очереди", value: stats.queued, cls: "text-blue-600 dark:text-blue-400" },
              { label: "Ошибок", value: stats.failed, cls: "text-red-600 dark:text-red-400" },
              { label: "Тест (skip)", value: stats.skipped, cls: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-semibold font-numeric ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ROUTING RULES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing rules · событие → тип группы</CardTitle>
          <CardDescription>
            Сообщения будут разосланы во все активные группы выбранного типа (MAX + Telegram).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Событие</TableHead>
                <TableHead>Тип группы</TableHead>
                <TableHead className="w-24 text-center">Активно</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="font-medium font-numeric text-xs">{rule.event_type}</div>
                    <div className="text-xs text-muted-foreground">{rule.description ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rule.notification_type}
                      onValueChange={(v) => updateRule(rule.id, { notification_type: v })}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIFICATION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.is_enabled}
                      onCheckedChange={(v) => updateRule(rule.id, { is_enabled: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QUEUE JOURNAL */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Журнал отправок</CardTitle>
              <CardDescription>Реальные сообщения, отправленные через CRM. Последние 100 записей.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="queued">В очереди</SelectItem>
                  <SelectItem value="sending">Отправка</SelectItem>
                  <SelectItem value="delivered">Доставлено</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                  <SelectItem value="skipped">Тест</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все платформы</SelectItem>
                  <SelectItem value="max">MAX</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Время</TableHead>
                <TableHead>Событие</TableHead>
                <TableHead>Платформа</TableHead>
                <TableHead>Группа</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Попытки</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Нет записей
                  </TableCell>
                </TableRow>
              ) : (
                filteredQueue.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-xs text-muted-foreground font-numeric">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(q.created_at), { locale: ru, addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium font-numeric">{q.event_type}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs" title={q.payload?.text}>
                        {q.payload?.text}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{q.platform.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{q.group_name ?? "—"}</div>
                      <div className="text-muted-foreground font-numeric">{q.group_id}</div>
                    </TableCell>
                    <TableCell>{statusBadge(q.status)}</TableCell>
                    <TableCell className="font-numeric text-xs">
                      {q.last_http_code ?? "—"}
                      {q.last_error && (
                        <div className="text-red-600 dark:text-red-400 truncate max-w-[160px]" title={q.last_error}>
                          {q.last_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-numeric text-xs text-center">{q.retry_count}</TableCell>
                    <TableCell>
                      {(q.status === "failed" || q.status === "skipped") && (
                        <Button size="sm" variant="ghost" onClick={() => retryItem(q.id)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* HEALTH DETAIL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health-check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {health.length === 0 ? (
            <div className="text-sm text-muted-foreground">Проверка ещё не запускалась — нажмите «Проверить сейчас».</div>
          ) : (
            health.map((h) => (
              <div key={h.component} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                <div className="flex items-center gap-2">
                  {healthDot(h.status)}
                  <span className="font-medium">{h.component}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {h.last_error && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={h.last_error}>
                      <AlertTriangle className="h-3 w-3" /> {h.last_error.slice(0, 60)}
                    </span>
                  )}
                  {h.status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  {h.latency_ms ? <span className="font-numeric">{h.latency_ms}ms</span> : null}
                  <span className="font-numeric">
                    {formatDistanceToNow(new Date(h.last_check_at), { locale: ru, addSuffix: true })}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
