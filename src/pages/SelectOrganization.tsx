import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

interface UserOrganization {
  id: string;
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
  };
}

const SelectOrganization = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setCurrentOrgId } = useCurrentOrganization();
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Если уже выбранная организация сохранена — сразу в дашборд
    const saved = localStorage.getItem("currentOrganizationId");
    if (saved) {
      navigate("/requests");
      return;
    }
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      // Гарантируем, что у пользователя есть организация и членство
      try {
        await supabase.rpc('ensure_user_initialized');
      } catch {}

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Запрашиваем только записи текущего пользователя
      const { data, error } = await supabase
        .from("user_organizations")
        .select(`
          id,
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setOrganizations(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-select if user has only one organization
  useEffect(() => {
    if (!loading && organizations.length === 1) {
      selectOrganization(organizations[0].organization_id);
    }
  }, [loading, organizations]);

  const selectOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    navigate("/requests");
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, string> = {
      owner: "Владелец",
      admin: "Администратор",
      member: "Сотрудник",
    };
    return roleMap[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">
            Выберите организацию для работы
          </p>
        </div>

        {organizations.length === 0 ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Нет доступных организаций</CardTitle>
              <CardDescription>
                У вас пока нет доступа ни к одной организации
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button onClick={async () => { await supabase.rpc('ensure_user_initialized'); await fetchOrganizations(); }}>
                <Plus className="h-4 w-4 mr-2" /> Создать мою организацию
              </Button>
              <Button variant="outline" onClick={fetchOrganizations}>Обновить</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {organizations.map((userOrg) => (
              <Card
                key={userOrg.id}
                className="border-border hover:border-primary transition-all cursor-pointer"
                onClick={() => selectOrganization(userOrg.organization_id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {userOrg.organizations.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                            {getRoleBadge(userOrg.role)}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Выбрать организацию
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectOrganization;
