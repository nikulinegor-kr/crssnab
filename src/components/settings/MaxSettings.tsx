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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bot, Info, Loader2, Plus, Send, Trash2, Webhook } from "lucide-react";

interface MaxSettingsProps {
  organizationId: string;
}

const NOTIFICATION_TYPES = [
  { value: "supply", label: "Поставка ТМЦ (приход/перемещение)" },
  { value: "invoice", label: "Счета на оплату" },
  { value: "request", label: "Входящие заявки" },
  { value: "alert", label: "CRSS оповещения" },
  { value: "general", label: "Общие" },
] as const;

interface MaxGroup {
  id: string;
  group_id: string;
  group_name: string;
  notification_type: string;
  is_active: boolean;
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/max-webhook`;

export const MaxSettings = ({ organizationId }: MaxSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<MaxGroup[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newType, setNewType] = useState<string>("general");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("max_groups" as any)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setGroups((data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const addGroup = async () => {
    if (!newGroupId.trim()) {
      toast({ title: "Укажите ID группы", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("max_groups" as any).insert({
      organization_id: organizationId,
      group_id: newGroupId.trim(),
      group_name: newGroupName.trim() || `Группа ${newGroupId.trim()}`,
      notification_type: newType,
      is_active: true,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    setNewGroupId(""); setNewGroupName(""); setNewType("general");
    toast({ title: "Группа добавлена" });
    load();
  };

  const toggle = async (g: MaxGroup) => {
    const { error } = await supabase
      .from("max_groups" as any)
      .update({ is_active: !g.is_active })
      .eq("id", g.id);
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
        text: `🔔 Тестовое уведомление из CRSS CRM\nГруппа: ${g.group_name}\nТип: ${labelForType(g.notification_type)}`,
      },
    });
    setTesting(null);
    if (error || (data as any)?.ok === false) {
      toast({
        title: "Не отправлено",
        description: error?.message || (data as any)?.error || "Проверьте подключение бота к группе",
        variant: "destructive",
      });
    } else {
      toast({ title: "Тестовое уведомление отправлено" });
    }
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    toast({ title: "Скопировано", description: "URL вебхука в буфере обмена" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>MAX бот (max.ru)</CardTitle>
        </div>
        <CardDescription>
          Уведомления в мессенджер MAX параллельно с Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm space-y-2">
            <p className="font-semibold">Как подключить:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Создайте бота через <code className="bg-muted px-1 rounded">@MasterBot</code> в MAX и получите токен.</li>
              <li>Токен уже сохранён в безопасных переменных CRM (MAX_BOT_TOKEN).</li>
              <li>Зарегистрируйте вебхук (URL ниже) в MAX через метод <code className="bg-muted px-1 rounded">subscriptions</code>.</li>
              <li>Добавьте бота в группу — он напишет ID группы и её название.</li>
              <li>Внесите этот ID в таблицу ниже и выберите тип уведомлений.</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>URL вебхука для MAX</Label>
          <div className="flex gap-2">
            <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
            <Button variant="outline" onClick={copyWebhook}>
              <Webhook className="h-4 w-4 mr-2" />Копировать
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Зарегистрируйте этот URL в MAX через <code>POST https://botapi.max.ru/subscriptions?access_token=…</code> с телом <code>{`{"url":"<этот URL>"}`}</code>.
          </p>
        </div>

        <div className="border-t pt-4 space-y-4">
          <h4 className="text-sm font-medium">Добавить группу</h4>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_220px_auto]">
            <Input
              placeholder="ID группы (от бота)"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
            />
            <Input
              placeholder="Название (для интерфейса)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addGroup} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" />Добавить</>}
            </Button>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h4 className="text-sm font-medium">Подключённые группы</h4>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Группы не добавлены</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{g.group_name}</span>
                      <Badge variant="outline">{labelForType(g.notification_type)}</Badge>
                      {!g.is_active && <Badge variant="secondary">Отключена</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">ID: {g.group_id}</div>
                  </div>
                  <Switch checked={g.is_active} onCheckedChange={() => toggle(g)} />
                  <Button size="sm" variant="outline" onClick={() => sendTest(g)} disabled={testing === g.id}>
                    {testing === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Тест</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(g)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

function labelForType(value: string) {
  return NOTIFICATION_TYPES.find((t) => t.value === value)?.label || value;
}
