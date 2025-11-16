import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Неверный формат email" }).max(255);
const passwordSchema = z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" });

interface OrgMember {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer" | "member";
  profiles: {
    email: string;
    organization_name: string;
    full_name?: string;
    position?: string;
  };
}

interface UsersManagementProps {
  organizationId: string;
  isAdmin: boolean;
}

export const UsersManagement = ({ organizationId, isAdmin }: UsersManagementProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchMembers();

    // Subscribe to real-time updates for user_organizations
    const channel = supabase
      .channel('user-organizations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_organizations',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      const { data: userOrgs, error: orgsError } = await supabase
        .from("user_organizations")
        .select("id, user_id, role")
        .eq("organization_id", organizationId);

      if (orgsError) throw orgsError;

      if (!userOrgs || userOrgs.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = userOrgs.map(uo => uo.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, organization_name, full_name, position")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const membersWithProfiles = userOrgs
        .map(uo => {
          const profile = profilesMap.get(uo.user_id);
          if (!profile) return null;
          
          return {
            id: uo.id,
            user_id: uo.user_id,
            role: uo.role,
            profiles: {
              email: profile.email,
              organization_name: profile.organization_name,
              full_name: profile.full_name,
              position: profile.position,
            }
          };
        })
        .filter(m => m !== null) as OrgMember[];

      setMembers(membersWithProfiles);
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
    const emailValidation = emailSchema.safeParse(newUserEmail);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: emailValidation.error.errors[0].message,
      });
      return;
    }

    const passwordValidation = passwordSchema.safeParse(newUserPassword);
    if (!passwordValidation.success) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: passwordValidation.error.errors[0].message,
      });
      return;
    }

    const trimmedEmail = emailValidation.data;

    if (!newUserFullName.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Введите ФИО пользователя",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();

      if (orgError) throw orgError;

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: trimmedEmail,
          password: newUserPassword,
          fullName: newUserFullName.trim(),
          position: newUserPosition.trim() || null,
          organizationId: organizationId,
          organizationName: orgData.name,
          role: newUserRole,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Не удалось создать пользователя");
      }

      toast({
        title: "Успешно",
        description: "Пользователь добавлен",
      });

      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFullName("");
      setNewUserPosition("");
      setNewUserRole("viewer");
      
      fetchMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const removeUser = async (memberId: string, userEmail: string) => {
    if (!confirm(`Удалить пользователя ${userEmail}?`)) return;

    try {
      const { error } = await supabase
        .from("user_organizations")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Пользователь удален",
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
    const roleNames: Record<string, string> = {
      owner: "Владелец",
      admin: "Администратор",
      editor: "Редактор",
      viewer: "Наблюдатель",
      member: "Участник",
    };
    return roleNames[role] || role;
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Доступ запрещен</CardTitle>
          <CardDescription>
            Только администраторы могут управлять пользователями
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Добавить пользователя</CardTitle>
          </div>
          <CardDescription>
            Создайте нового пользователя и назначьте ему роль
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">ФИО *</Label>
              <Input
                id="fullName"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Input
                id="position"
                value={newUserPosition}
                onChange={(e) => setNewUserPosition(e.target.value)}
                placeholder="Менеджер"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль *</Label>
              <Input
                id="password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Минимум 6 символов"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Роль *</Label>
            <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Администратор</SelectItem>
                <SelectItem value="editor">Редактор</SelectItem>
                <SelectItem value="viewer">Наблюдатель</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={addUser} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Добавить пользователя
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи организации</CardTitle>
          <CardDescription>
            Управление пользователями и их ролями
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.profiles.full_name || "—"}</TableCell>
                    <TableCell>{member.profiles.email}</TableCell>
                    <TableCell>{member.profiles.position || "—"}</TableCell>
                    <TableCell>{getRoleName(member.role)}</TableCell>
                    <TableCell className="text-right">
                      {member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUser(member.id, member.profiles.email)}
                        >
                          <Trash2 className="h-4 w-4" />
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
  );
};
