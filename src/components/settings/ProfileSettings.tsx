import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ProfileSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, position, telegram_user_id, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || "");
        setPosition(data.position || "");
        setTelegramUserId(data.telegram_user_id?.toString() || "");
        setEmail(data.email || "");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить профиль",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData: any = {
        full_name: fullName,
        position: position,
      };

      // Only update telegram_user_id if it's a valid number or null
      if (telegramUserId.trim()) {
        const parsedId = parseInt(telegramUserId.trim());
        if (isNaN(parsedId)) {
          toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Telegram User ID должен быть числом",
          });
          return;
        }
        updateData.telegram_user_id = parsedId;
      } else {
        updateData.telegram_user_id = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Профиль обновлен",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
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
          <User className="h-5 w-5 text-primary" />
          <CardTitle>Профиль</CardTitle>
        </div>
        <CardDescription>
          Управление вашим профилем и уведомлениями
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">ФИО</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иванов Иван Иванович"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position">Должность</Label>
          <Input
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Менеджер"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegramUserId">Telegram User ID</Label>
          <Input
            id="telegramUserId"
            value={telegramUserId}
            onChange={(e) => setTelegramUserId(e.target.value)}
            placeholder="123456789"
            type="text"
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Чтобы получать личные уведомления о изменениях статусов заявок, укажите ваш Telegram User ID. 
              Узнать его можно у бота{" "}
              <a 
                href="https://t.me/userinfobot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                @userinfobot
              </a>
            </AlertDescription>
          </Alert>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить изменения"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
