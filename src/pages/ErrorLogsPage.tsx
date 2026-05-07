import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, RefreshCw, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ErrorLog {
  id: string;
  created_at: string;
  severity: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  organization_id: string | null;
}

const severityColor = (s: string) => {
  if (s === "error") return "destructive";
  if (s === "warning") return "secondary";
  return "outline";
};

const severityIcon = (s: string) => {
  if (s === "error") return <AlertCircle className="h-3.5 w-3.5" />;
  if (s === "warning") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
};

export default function ErrorLogsPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { currentOrgId } = useCurrentOrganization();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [period, setPeriod] = useState<string>("7d");
  const [deployment, setDeployment] = useState<string>("all");
  const [selected, setSelected] = useState<ErrorLog | null>(null);

  const deployments = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const d = (l.context as Record<string, unknown> | null)?.deployment_id;
      if (typeof d === "string" && d) set.add(d);
    }
    return Array.from(set);
  }, [logs]);

  const parseUA = (ua: string | null): string => {
    if (!ua) return "—";
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\/|Opera/.test(ua)) return "Opera";
    if (/YaBrowser/.test(ua)) return "Yandex";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua)) return "Safari";
    return "Other";
  };

  const periodSinceISO = useMemo(() => {
    const now = Date.now();
    const map: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now - (map[period] ?? map["7d"])).toISOString();
  }, [period]);

  const load = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    let q = supabase
      .from("client_error_logs")
      .select("*")
      .eq("organization_id", currentOrgId)
      .gte("created_at", periodSinceISO)
      .order("created_at", { ascending: false })
      .limit(500);

    if (severity !== "all") q = q.eq("severity", severity);

    const { data, error } = await q;
    if (error) {
      console.error("Failed to load error logs:", error);
      setLogs([]);
    } else {
      setLogs((data ?? []) as ErrorLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId, severity, periodSinceISO]);

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return logs.filter((log) => {
      if (deployment !== "all") {
        const d = (log.context as Record<string, unknown> | null)?.deployment_id;
        if (d !== deployment) return false;
      }
      if (!terms.length) return true;
      const hay = `${log.message} ${log.url ?? ""} ${log.stack ?? ""} ${JSON.stringify(log.context ?? {})}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [logs, search, deployment]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Журнал ошибок клиента</h1>
        <p className="text-sm text-muted-foreground">
          Ошибки и предупреждения, отправленные браузерами пользователей. Помогает диагностировать
          подвисания загрузки и проблемы интерфейса.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Поиск по сообщению, URL, стеку…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue placeholder="Уровень" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все уровни</SelectItem>
              <SelectItem value="error">Ошибки</SelectItem>
              <SelectItem value="warning">Предупреждения</SelectItem>
              <SelectItem value="info">Инфо</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Последний час</SelectItem>
              <SelectItem value="24h">24 часа</SelectItem>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deployment} onValueChange={setDeployment}>
            <SelectTrigger>
              <SelectValue placeholder="Deployment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все деплои</SelectItem>
              {deployments.map((d) => (
                <SelectItem key={d} value={d}>{d.slice(0, 12)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Записи: {filtered.length}
            {filtered.length === 500 ? " (лимит)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Время</TableHead>
                  <TableHead className="w-[110px]">Уровень</TableHead>
                  <TableHead>Сообщение</TableHead>
                  <TableHead className="w-[180px]">Маршрут</TableHead>
                  <TableHead className="w-[90px]">Протокол</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Записей нет
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => {
                    const ctx = (log.context ?? {}) as Record<string, unknown>;
                    return (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer odd:bg-muted/30"
                        onClick={() => setSelected(log)}
                      >
                        <TableCell className="font-numeric text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(log.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={severityColor(log.severity) as "destructive" | "secondary" | "outline"}
                            className="gap-1"
                          >
                            {severityIcon(log.severity)}
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[400px] truncate">{log.message}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {(ctx.route as string) ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs font-numeric">
                          {(ctx.protocol as string) ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge
                    variant={severityColor(selected.severity) as "destructive" | "secondary" | "outline"}
                    className="gap-1"
                  >
                    {severityIcon(selected.severity)}
                    {selected.severity}
                  </Badge>
                  <span className="text-base">{new Date(selected.created_at).toLocaleString("ru-RU")}</span>
                </SheetTitle>
                <SheetDescription className="break-words text-foreground text-sm">
                  {selected.message}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <Section title="URL">
                  <code className="break-all text-xs">{selected.url ?? "—"}</code>
                </Section>
                <Section title="User-Agent">
                  <code className="break-all text-xs">{selected.user_agent ?? "—"}</code>
                </Section>
                <Section title="Контекст">
                  <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64">
                    {JSON.stringify(selected.context ?? {}, null, 2)}
                  </pre>
                </Section>
                {selected.stack && (
                  <Section title="Stack trace">
                    <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap">
                      {selected.stack}
                    </pre>
                  </Section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}
