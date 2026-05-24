import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bug, Send, CheckCircle2, XCircle, Copy } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props { organizationId: string }
interface MaxGroup { id: string; group_id: string; group_name: string }

export function MaxDirectDebug({ organizationId }: Props) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<MaxGroup[]>([]);
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("🔧 Direct MAX API test");
  const [mode, setMode] = useState<"auto" | "envelope" | "legacy" | "query">("auto");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [lastLog, setLastLog] = useState<any>(null);

  useEffect(() => { load(); }, [organizationId]);

  const load = async () => {
    const { data } = await supabase.from("max_groups")
      .select("id,group_id,group_name")
      .eq("organization_id", organizationId);
    setGroups((data ?? []) as MaxGroup[]);
    const { data: log } = await supabase.from("max_webhook_logs")
      .select("event_type,payload,created_at")
      .in("event_type", ["outgoing_ok", "outgoing_error", "direct_send_ok", "direct_send_error"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setLastLog(log);
  };

  const send = async () => {
    if (!chatId) {
      toast({ title: "Укажите chat_id", variant: "destructive" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("max-direct-send", {
        body: { chat_id: chatId, text, organization_id: organizationId, mode },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: data?.delivered ? "Доставлено" : "Не доставлено",
        description: `HTTP ${data?.status} · ${data?.mode_used}`,
        variant: data?.delivered ? "default" : "destructive",
      });
      load();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast({ title: "Скопировано" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" /> MAX API · прямая отправка / отладка
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Отправляет POST <code className="px-1 bg-muted rounded">https://platform-api.max.ru/messages</code> в обход CRM-логики.
          Показывает полный request / response.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Группа (chat_id, строкой)</Label>
            <div className="flex gap-2">
              <Input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-75086506652357"
                className="font-mono text-sm"
              />
              {groups.length > 0 && (
                <Select onValueChange={(v) => setChatId(v)}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="из списка" /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.group_id}>{g.group_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Режим отправки</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto (envelope → legacy → query)</SelectItem>
                <SelectItem value="envelope">envelope (рекомендуемый новый)</SelectItem>
                <SelectItem value="legacy">legacy ?chat_id=</SelectItem>
                <SelectItem value="query">legacy + ?access_token=</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>&nbsp;</Label>
            <Button onClick={send} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Отправить напрямую в MAX API
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Текст сообщения</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        </div>

        <div className="rounded-md border p-3 bg-muted/30 text-xs">
          <div className="font-medium mb-1">Payload который будет отправлен (envelope):</div>
          <pre className="font-mono whitespace-pre-wrap">{JSON.stringify({
            endpoint: "https://platform-api.max.ru/messages",
            method: "POST",
            headers: { Authorization: "***MAX_BOT_TOKEN***", "Content-Type": "application/json" },
            body: { recipient: { chat_id: chatId || "<chat_id>", chat_type: "chat" }, message: { text } },
          }, null, 2)}</pre>
        </div>

        {result && (
          <div className="rounded-md border p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {result.delivered ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="font-medium">{result.delivered ? "Доставлено" : "Не доставлено"}</span>
              <Badge variant="outline">HTTP {result.status}</Badge>
              <Badge variant="secondary">{result.mode_used}</Badge>
              <code className="text-[10px] text-muted-foreground break-all">{result.endpoint}</code>
              <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto" onClick={() => copy(JSON.stringify(result, null, 2))}>
                <Copy className="h-3 w-3 mr-1" /> Копировать
              </Button>
            </div>

            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">
                {result.attempts?.map((a: any, i: number) => (
                  <div key={i} className="border rounded p-2 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      {a.delivered ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      <span className="font-medium">{a.mode}</span>
                      <Badge variant="outline" className="text-[10px]">HTTP {a.http_status}</Badge>
                      <span className="text-muted-foreground">{a.duration_ms}ms</span>
                    </div>
                    <div className="text-[11px] break-all"><b>URL:</b> {a.endpoint}</div>
                    <div className="text-[11px]"><b>Headers:</b> <code>{JSON.stringify(a.request_headers)}</code></div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px]">Request payload</summary>
                      <pre className="whitespace-pre-wrap font-mono mt-1 bg-muted/40 p-2 rounded">{JSON.stringify(a.request_payload, null, 2)}</pre>
                    </details>
                    <details className="mt-1" open={!a.delivered}>
                      <summary className="cursor-pointer text-[11px]">Response body</summary>
                      <pre className="whitespace-pre-wrap font-mono mt-1 bg-muted/40 p-2 rounded">{a.response_body}</pre>
                    </details>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {lastLog && (
          <div className="rounded-md border p-3 bg-muted/20">
            <div className="text-xs font-medium mb-1 flex items-center gap-2">
              Последний payload MAX
              <Badge variant="outline" className="text-[10px]">{lastLog.event_type}</Badge>
              <span className="text-muted-foreground">{new Date(lastLog.created_at).toLocaleString("ru-RU")}</span>
            </div>
            <ScrollArea className="max-h-[200px]">
              <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(lastLog.payload, null, 2)}</pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
