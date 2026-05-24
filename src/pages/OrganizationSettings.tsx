import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, User, Settings, Shield, Bell, CreditCard, UserCheck, Building2, FileText, Palette, Send, Bot, CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { MaxSettings } from "@/components/settings/MaxSettings";
import { MaxRoutingSchema } from "@/components/settings/MaxRoutingSchema";
import { MaxDirectDebug } from "@/components/settings/MaxDirectDebug";
import { NotificationRoutingInfo } from "@/components/settings/NotificationRoutingInfo";
import { NotificationScenarioTester } from "@/components/settings/NotificationScenarioTester";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { RequestSettings } from "@/components/settings/RequestSettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { AccessManagement } from "@/components/settings/AccessManagement";
import { ParticipantsManagement } from "@/components/settings/ParticipantsManagement";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { DeadlineReminderSettings } from "@/components/settings/DeadlineReminderSettings";
import { ObjectsManagement } from "@/components/settings/ObjectsManagement";
import { SettingsSection } from "@/components/settings/SettingsSection";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const { role, isAdmin, isViewer, loading: roleLoading } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");

  const isEditor = role === "editor";
  const visibleTabs = isAdmin
    ? ["profile", "general", "access", "notifications", "subscription"]
    : isEditor
      ? ["profile", "notifications"]
      : ["profile"];

  const defaultTab = "profile";

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
      return;
    }

    if (!roleLoading && isViewer) {
      toast({
        title: "Доступ запрещен",
        description: "У вас нет доступа к настройкам организации",
        variant: "destructive",
      });
      navigate("/requests");
      return;
    }

    loadSettings();
  }, [currentOrgId, roleLoading, isViewer]);

  const loadSettings = async () => {
    if (!currentOrgId) return;

    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", currentOrgId)
        .single();

      if (error) throw error;

      if (data) {
        setOrgName(data.name);
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

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Настройки организации</h1>
        <p className="text-sm sm:text-base text-muted-foreground">{orgName}</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4 sm:space-y-6" orientation="horizontal">
        <div className="border-b overflow-x-auto">
          <TabsList className="inline-flex h-auto w-auto min-w-full sm:min-w-0 rounded-none bg-transparent p-0">
            {visibleTabs.includes("profile") && (
              <TabsTrigger value="profile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200">
                <User className="h-4 w-4" /><span className="hidden sm:inline">Профиль</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes("general") && (
              <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200">
                <Settings className="h-4 w-4" /><span className="hidden sm:inline">Общие</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes("access") && (
              <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200">
                <Shield className="h-4 w-4" /><span className="hidden sm:inline">Пользователи и доступ</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes("notifications") && (
              <TabsTrigger value="notifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200">
                <Bell className="h-4 w-4" /><span className="hidden sm:inline">Уведомления</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes("subscription") && (
              <TabsTrigger value="subscription" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200">
                <CreditCard className="h-4 w-4" /><span className="hidden sm:inline">Подписка</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {visibleTabs.includes("profile") && (
          <TabsContent value="profile" className="space-y-4">
            <SettingsSection title="Ваш профиль" description="Управление личными данными и уведомлениями" icon={User}>
              <ProfileSettings />
            </SettingsSection>
          </TabsContent>
        )}

        {visibleTabs.includes("general") && (
          <TabsContent value="general" className="space-y-8">
            <SettingsSection title="Общие настройки" description="Основная информация об организации" icon={Settings}>
              <GeneralSettings organizationId={currentOrgId!} />
            </SettingsSection>
            <SettingsSection title="Брендинг" description="Логотип и цветовая схема организации" icon={Palette}>
              <BrandingSettings organizationId={currentOrgId!} />
            </SettingsSection>
            <SettingsSection title="Настройки заявок" description="Статусы, приоритеты и поля заявок" icon={FileText}>
              <RequestSettings organizationId={currentOrgId!} />
            </SettingsSection>
            <SettingsSection title="Объекты" description="Управление объектами для заявок" icon={Building2}>
              <ObjectsManagement />
            </SettingsSection>
          </TabsContent>
        )}

        {visibleTabs.includes("access") && (
          <TabsContent value="access" className="space-y-8">
            <SettingsSection title="Пользователи и доступ" description="Управление командой, ролями и правами доступа к разделам" icon={Shield}>
              <AccessManagement organizationId={currentOrgId!} />
            </SettingsSection>
            <SettingsSection title="Участники заявок" description="Заявители, исполнители и подрядчики" icon={UserCheck}>
              <ParticipantsManagement />
            </SettingsSection>
          </TabsContent>
        )}

        {visibleTabs.includes("notifications") && (
          <TabsContent value="notifications" className="space-y-6">
            <SettingsSection title="Управление уведомлениями" description="Telegram, MAX и автонапоминания" icon={Bell}>
              <NotificationRoutingInfo />
              <Tabs defaultValue="telegram" className="mt-6">
                <TabsList>
                  <TabsTrigger value="telegram" className="gap-1.5">
                    <Send className="h-4 w-4" /> Telegram
                  </TabsTrigger>
                  <TabsTrigger value="max" className="gap-1.5">
                    <Bot className="h-4 w-4" /> MAX
                  </TabsTrigger>
                  <TabsTrigger value="tester" className="gap-1.5">
                    <Bell className="h-4 w-4" /> Тест сценариев
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="reminders" className="gap-1.5">
                      <CalendarClock className="h-4 w-4" /> Напоминания
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="telegram" className="mt-4">
                  <NotificationSettings organizationId={currentOrgId!} />
                </TabsContent>
                <TabsContent value="max" className="mt-4 space-y-6">
                  <MaxRoutingSchema organizationId={currentOrgId!} />
                  <MaxSettings organizationId={currentOrgId!} />
                </TabsContent>
                <TabsContent value="tester" className="mt-4">
                  <NotificationScenarioTester organizationId={currentOrgId!} orgName={orgName} />
                </TabsContent>
                {isAdmin && (
                  <TabsContent value="reminders" className="mt-4">
                    <DeadlineReminderSettings />
                  </TabsContent>
                )}
              </Tabs>
            </SettingsSection>
          </TabsContent>
        )}

        {visibleTabs.includes("subscription") && (
          <TabsContent value="subscription">
            <SettingsSection title="Подписка" description="Управление тарифным планом" icon={CreditCard}>
              <SubscriptionSettings organizationId={currentOrgId!} />
            </SettingsSection>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;
