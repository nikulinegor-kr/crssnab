import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    email: string;
    organization_name: string;
  };
}

const ManageUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "member">("member");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
      return;
    }
    checkAdminStatus();
    fetchMembers();
  }, [currentOrgId]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_organizations")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrgId)
        .single();

      if (error) throw error;
      setIsAdmin(data.role === "owner" || data.role === "admin");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  };

  const fetchMembers = async () => {
    try {
      // First get user_organizations
      const { data: userOrgs, error: orgsError } = await supabase
        .from("user_organizations")
        .select("id, user_id, role")
        .eq("organization_id", currentOrgId);

      if (orgsError) throw orgsError;

      // Then get profiles for each user
      const userIds = userOrgs?.map(org => org.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, organization_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const combined = userOrgs?.map(org => ({
        ...org,
        profiles: profiles?.find(p => p.id === org.user_id) || { email: "", organization_name: "" }
      })) || [];

      setMembers(combined);
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

  const addUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите email пользователя",
      });
      return;
    }

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newUserEmail.trim())
        .single();

      if (profileError) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Пользователь с таким email не найден",
        });
        return;
      }

      // Add user to organization
      const { error } = await supabase
        .from("user_organizations")
        .insert({
          user_id: profile.id,
          organization_id: currentOrgId,
          role: newUserRole,
        });

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Пользователь добавлен в организацию",
      });

      setNewUserEmail("");
      fetchMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  };

  const removeUser = async (membershipId: string) => {
    try {
      const { error } = await supabase
        .from("user_organizations")
        .delete()
        .eq("id", membershipId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Пользователь удален из организации",
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    }
  };

  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      owner: "Владелец",
      admin: "Администратор",
      member: "Сотрудник",
    };
    return roleMap[role] || role;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Доступ запрещен</CardTitle>
              <CardDescription>
                У вас нет прав для управления пользователями
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/dashboard")}>
                Вернуться в дашборд
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Управление пользователями
                </h1>
                <p className="text-sm text-muted-foreground">
                  Добавляйте и управляйте пользователями организации
                </p>
              </div>
            </div>
            <OrganizationSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Добавить пользователя</CardTitle>
            <CardDescription>
              Введите email пользователя, который уже зарегистрирован в системе
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Email пользователя"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={newUserRole}
                onValueChange={(value: "admin" | "member") =>
                  setNewUserRole(value)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="member">Сотрудник</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addUser}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Пользователи организации</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.profiles.email}</TableCell>
                      <TableCell>
                        <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                          {getRoleName(member.role)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeUser(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManageUsers;
