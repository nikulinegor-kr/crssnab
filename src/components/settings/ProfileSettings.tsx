import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Loader2, CheckCircle2, Circle, Send, Phone, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUserRole } from "@/hooks/useUserRole";

interface ProfileData {
  fullName: string;
  position: string;
  telegramUserId: string;
  email: string;
  phone: string;
}

export const ProfileSettings = () => {
  const { toast } = useToast();
  const { role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    fullName: "",
    position: "",
    telegramUserId: "",
    email: "",
    phone: "",
  });

  const [initial, setInitial] = useState<ProfileData>({
    fullName: "",
    position: "",
    telegramUserId: "",
    email: "",
    phone: "",
  });

  const hasChanges = useMemo(() => {
    return (
      profile.fullName !== initial.fullName ||
      profile.position !== initial.position ||
      profile.telegramUserId !== initial.telegramUserId ||
      profile.phone !== initial.phone
    );
  }, [profile, initial]);

  const telegramConnected = profile.telegramUserId.trim().length > 0;

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
        // phone column was just added, fetch separately to avoid type error
        const { data: phoneData } = await supabase
          .from("profiles")
          .select("phone" as any)
          .eq("id", user.id)
          .single();

        const loaded: ProfileData = {
          fullName: data.full_name || "",
          position: data.position || "",
          telegramUserId: data.telegram_user_id?.toString() || "",
          email: data.email || "",
          phone: (phoneData as any)?.phone || "",
        };
        setProfile(loaded);
        setInitial(loaded);
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
        full_name: profile.fullName,
        position: profile.position,
        phone: profile.phone || null,
      };

      if (profile.telegramUserId.trim()) {
        const parsedId = parseInt(profile.telegramUserId.trim());
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

      setInitial({ ...profile });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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

  const handleTestTelegram = async () => {
    if (!profile.telegramUserId.trim()) return;
    try {
      setTestingSend(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's organization
      const { data: orgData } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!orgData) {
        toast({ variant: "destructive", title: "Ошибка", description: "Организация не найдена" });
        return;
      }

      // Get telegram settings for org
      const { data: tgSettings } = await supabase
        .from("telegram_settings")
        .select("bot_token")
        .eq("organization_id", orgData.organization_id)
        .single();

      if (!tgSettings?.bot_token) {
        toast({ variant: "destructive", title: "Ошибка", description: "Telegram бот не настроен для организации" });
        return;
      }

      // Send test message via edge function
      const { data, error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          action: "test_personal",
          telegramUserId: parseInt(profile.telegramUserId.trim()),
          organizationId: orgData.organization_id,
        },
      });

      if (error) throw error;

      if (data?.success === false) {
        toast({ variant: "destructive", title: "Ошибка", description: data.error || "Не удалось отправить" });
        return;
      }

      toast({ title: "Отправлено", description: "Тестовое сообщение отправлено в Telegram" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message || "Не удалось отправить" });
    } finally {
      setTestingSend(false);
    }
  };

  const roleLabel = role === "owner" ? "Владелец" : role === "admin" ? "Администратор" : role === "editor" ? "Редактор" : role === "viewer" ? "Наблюдатель" : "Участник";

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-[600px] space-y-8">
      {/* === Основное === */}
      <section className="space-y-5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">Основное</h3>
        <Separator />
        <div className="space-y-4">
          <FieldRow label="Email">
            <Input
              value={profile.email}
              disabled
              className="bg-muted/50 border-border/60"
            />
          </FieldRow>

          <FieldRow label="ФИО">
            <Input
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              placeholder="Иванов Иван Иванович"
            />
          </FieldRow>

          <FieldRow label="Должность">
            <Input
              value={profile.position}
              onChange={(e) => setProfile({ ...profile, position: e.target.value })}
              placeholder="Менеджер по закупкам"
            />
          </FieldRow>

          <FieldRow label="Телефон" icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />} optional>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+7 (999) 123-45-67"
            />
          </FieldRow>
        </div>
      </section>

      {/* === Уведомления === */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground tracking-tight">Уведомления</h3>
          {telegramConnected ? (
            <Badge variant="outline" className="gap-1.5 border-green-500/30 bg-green-500/10 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Подключено
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <Circle className="h-3 w-3" />
              Не подключено
            </Badge>
          )}
        </div>
        <Separator />
        <div className="space-y-4">
          <FieldRow label="Telegram User ID">
            <Input
              value={profile.telegramUserId}
              onChange={(e) => setProfile({ ...profile, telegramUserId: e.target.value })}
              placeholder="123456789"
            />
          </FieldRow>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground leading-relaxed">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Чтобы получать уведомления, укажите Telegram ID.
              Получить его можно через{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                @userinfobot
              </a>
            </span>
          </div>

          {telegramConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              disabled={testingSend}
              className="gap-2"
            >
              {testingSend ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Проверить подключение
            </Button>
          )}
        </div>
      </section>

      {/* === Система === */}
      <section className="space-y-5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">Система</h3>
        <Separator />
        <div className="space-y-4">
          <FieldRow label="Роль" icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}>
            <div className="flex items-center h-10 px-3 rounded-md border border-border/60 bg-muted/50 text-sm text-foreground">
              {roleLabel}
            </div>
          </FieldRow>
        </div>
      </section>

      {/* === Сохранение === */}
      <div className="pt-2">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Сохранено
            </>
          ) : (
            "Сохранить изменения"
          )}
        </Button>
      </div>
    </div>
  );
};

function FieldRow({
  label,
  children,
  icon,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1.5 sm:gap-4 items-start sm:items-center">
      <Label className="flex items-center gap-1.5 text-sm text-muted-foreground pt-0 sm:pt-2.5">
        {icon}
        {label}
        {optional && <span className="text-xs text-muted-foreground/60">(опц.)</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}
