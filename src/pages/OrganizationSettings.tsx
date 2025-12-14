import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, User, Settings, Users, UserCheck, Bell, FileText, Palette, CreditCard, Plug, Eye, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramSettings } from "@/components/settings/TelegramSettings";
import { UsersManagement } from "@/components/settings/UsersManagement";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { RequestSettings } from "@/components/settings/RequestSettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { AuditLog } from "@/components/settings/AuditLog";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { ParticipantsManagement } from "@/components/settings/ParticipantsManagement";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { DeadlineReminderSettings } from "@/components/settings/DeadlineReminderSettings";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { ViewSettings } from "@/components/settings/ViewSettings";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
      return;
    }

    if (!roleLoading && !isAdmin) {
      toast({
        title: "Доступ запрещен",
        description: "Только администраторы могут изменять настройки организации",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadSettings();
  }, [currentOrgId, isAdmin, roleLoading]);

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

      <Tabs defaultValue="general" className="space-y-4 sm:space-y-6" orientation="horizontal">
        <div className="border-b overflow-x-auto">
          <TabsList className="inline-flex h-auto w-auto min-w-full sm:min-w-0 rounded-none bg-transparent p-0">
            <TabsTrigger 
              value="profile"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Профиль</span>
            </TabsTrigger>
            <TabsTrigger 
              value="general"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Общие</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Пользователи</span>
            </TabsTrigger>
            <TabsTrigger 
              value="participants"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Участники</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Уведомления</span>
            </TabsTrigger>
            <TabsTrigger 
              value="requests"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Заявки</span>
            </TabsTrigger>
            <TabsTrigger 
              value="branding"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Брендинг</span>
            </TabsTrigger>
            <TabsTrigger 
              value="subscription"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Подписка</span>
            </TabsTrigger>
            <TabsTrigger 
              value="integrations"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Интеграции</span>
            </TabsTrigger>
            <TabsTrigger 
              value="view"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Отображение</span>
            </TabsTrigger>
            <TabsTrigger 
              value="audit"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs sm:text-sm whitespace-nowrap px-2 sm:px-4 gap-1.5 transition-all duration-200"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">История</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="general">
          <GeneralSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="users">
          <UsersManagement 
            organizationId={currentOrgId!} 
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsManagement />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <PushNotificationSettings />
          <TelegramSettings organizationId={currentOrgId!} />
          <DeadlineReminderSettings />
        </TabsContent>

        <TabsContent value="requests">
          <RequestSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="view">
          <ViewSettings />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog organizationId={currentOrgId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;