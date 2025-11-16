import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelegramSettings } from "@/components/settings/TelegramSettings";
import { UsersManagement } from "@/components/settings/UsersManagement";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { RequestSettings } from "@/components/settings/RequestSettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";

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
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Настройки организации</h1>
        <p className="text-muted-foreground">{orgName}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="general">Общие</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="notifications">Уведомления</TabsTrigger>
          <TabsTrigger value="requests">Заявки</TabsTrigger>
          <TabsTrigger value="branding">Брендинг</TabsTrigger>
          <TabsTrigger value="subscription">Подписка</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings organizationId={currentOrgId!} />
        </TabsContent>

        <TabsContent value="users">
          <UsersManagement 
            organizationId={currentOrgId!} 
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <TelegramSettings organizationId={currentOrgId!} />
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
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;