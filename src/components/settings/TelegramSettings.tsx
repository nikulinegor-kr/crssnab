import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, Info, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

interface TelegramSettingsProps {
  organizationId: string;
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

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      // Use admin-only RPC to get Telegram credentials securely
      const { data, error } = await supabase.rpc('get_telegram_credentials', {
        _org_id: organizationId
      });

      if (error) throw error;

      // RPC returns an array, get first row if exists
      const settings = Array.isArray(data) ? data[0] : data;
      
      if (settings) {
        setBotToken(settings.telegram_bot_token || "");
        setChatId(settings.telegram_chat_id || "");
        setAutoSendOnCreate(settings.telegram_auto_send_on_create ?? true);
        setAutoSendOnStatusChange(settings.telegram_auto_send_on_status_change ?? true);
        setInvoiceChatId(settings.telegram_invoice_chat_id || "");
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки. Убедитесь, что у вас есть права администратора.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (botToken && !botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
      toast({
        title: "Ошибка",
        description: "Неверный формат токена бота",
        variant: "destructive",
      });
      return;
    }

    if (chatId && !chatId.match(/^-?\d+$/)) {
      toast({
        title: "Ошибка",
        description: "Chat ID должен быть числом",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          telegram_bot_token: botToken || null,
          telegram_chat_id: chatId || null,
          telegram_auto_send_on_create: autoSendOnCreate,
          telegram_auto_send_on_status_change: autoSendOnStatusChange,
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Настройки сохранены",
      });
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
                <li>Отправьте сообщение в группу и получите chat_id через <a href="https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">API <ExternalLink className="h-3 w-3" /></a></li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">Токен бота</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Формат: <code className="bg-muted px-1 py-0.5 rounded">123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatId">Chat ID группы/канала</Label>
            <Input
              id="chatId"
              type="text"
              placeholder="-1001234567890"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Для групп обычно начинается с <code className="bg-muted px-1 py-0.5 rounded">-100</code>
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
            <Switch
              id="autoSendOnCreate"
              checked={autoSendOnCreate}
              onCheckedChange={setAutoSendOnCreate}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoSendOnStatusChange">При изменении статуса</Label>
              <p className="text-xs text-muted-foreground">
                Автоматически отправлять уведомление при изменении статуса заявки
              </p>
            </div>
            <Switch
              id="autoSendOnStatusChange"
              checked={autoSendOnStatusChange}
              onCheckedChange={setAutoSendOnStatusChange}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </CardContent>
    </Card>
  );
};
