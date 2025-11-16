import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, Info, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TelegramSettingsProps {
  organizationId: string;
}

export const TelegramSettings = ({ organizationId }: TelegramSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("telegram_bot_token, telegram_chat_id")
        .eq("id", organizationId)
        .single();

      if (error) throw error;

      if (data) {
        setBotToken(data.telegram_bot_token || "");
        setChatId(data.telegram_chat_id || "");
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки",
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

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </CardContent>
    </Card>
  );
};
