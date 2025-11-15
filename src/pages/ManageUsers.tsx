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
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Неверный формат email" }).max(255);
const passwordSchema = z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" });

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    email: string;
    organization_name: string;
    full_name?: string;
    position?: string;
  };
}

const ManageUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrgId } = useCurrentOrganization();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!currentOrgId) {
      navigate("/select-organization");
      return;
    }
    checkAdminStatus();
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
          filter: `organization_id=eq.${currentOrgId}`
        },
        (payload) => {
          console.log('User organization change:', payload);
          // Refetch members when changes occur
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      setLoading(true);
      
      // First get user_organizations
      const { data: userOrgs, error: orgsError } = await supabase
        .from("user_organizations")
        .select("id, user_id, role")
        .eq("organization_id", currentOrgId);

      if (orgsError) throw orgsError;

      if (!userOrgs || userOrgs.length === 0) {
        setMembers([]);
        return;
      }

      // Then get profiles for each user
      const userIds = userOrgs.map(org => org.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, organization_name, full_name, position")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const combined = userOrgs.map(org => ({
        ...org,
        profiles: profiles?.find(p => p.id === org.user_id) || { 
          email: "Loading...", 
          organization_name: "",
          full_name: "",
          position: ""
        }
      }));

      setMembers(combined);
    } catch (error: any) {
      console.error("Error fetching members:", error);
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
    // Validate email
    const emailValidation = emailSchema.safeParse(newUserEmail);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: emailValidation.error.errors[0].message,
      });
      return;
    }

    // Validate password
    const passwordValidation = passwordSchema.safeParse(newUserPassword);
    if (!passwordValidation.success) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: passwordValidation.error.errors[0].message,
      });
      return;
    }

    setIsCreating(true);
    try {
      // Call Edge Function to create user
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: emailValidation.data,
            password: passwordValidation.data,
            fullName: newUserFullName.trim(),
            position: newUserPosition.trim(),
            organizationId: currentOrgId,
            role: newUserRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      toast({
        title: "Успешно",
        description: `Пользователь ${emailValidation.data} создан и добавлен в организацию`,
      });
      
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFullName("");
      setNewUserPosition("");
      setNewUserRole("viewer");
      
      // Wait a bit for trigger to complete, then refetch
      setTimeout(() => {
        fetchMembers();
      }, 500);
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
    switch (role) {
      case "owner":
        return "Владелец";
      case "admin":
        return "Управляющий";
      case "editor":
        return "Может добавлять заявки";
      case "viewer":
        return "Только чтение";
      default:
        return role;
    }
  };

  if (!isAdmin) {
    return (
      <div className="w-full p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Доступ запрещен</CardTitle>
              <CardDescription>
                У вас нет прав для управления пользователями
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>
              Управление пользователями
            </CardTitle>
            <CardDescription>
              Добавляйте и управляйте пользователями организации
            </CardDescription>
          </CardHeader>
          <CardHeader>
            <CardTitle>Создать пользователя</CardTitle>
            <CardDescription>
              Создайте нового пользователя и добавьте его в организацию
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="ФИО"
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Должность"
                  value={newUserPosition}
                  onChange={(e) => setNewUserPosition(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="email"
                  placeholder="Email пользователя"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Пароль (мин. 6 символов)"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Управляющий (все права)</SelectItem>
                    <SelectItem value="editor">Может добавлять заявки</SelectItem>
                    <SelectItem value="viewer">Только чтение</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addUser} disabled={isCreating} className="min-w-[140px]">
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать
                    </>
                  )}
                </Button>
              </div>
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
                      <TableCell className="font-medium">
                        {member.profiles.full_name || "—"}
                      </TableCell>
                      <TableCell>{member.profiles.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.profiles.position || "—"}
                      </TableCell>
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
