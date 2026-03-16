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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Users, Pencil, Copy, Mail, Check } from "lucide-react";
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
  
  // Credentials dialog state
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; fullName: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit user state
  const [editingUser, setEditingUser] = useState<OrgMember | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "editor" | "viewer" | "member">("viewer");
  const [isUpdating, setIsUpdating] = useState(false);

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

      // Show credentials dialog
      setCreatedCredentials({
        email: trimmedEmail,
        password: newUserPassword,
        fullName: newUserFullName.trim(),
      });
      setCredentialsDialogOpen(true);

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

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "delete",
        _entity_type: "user",
        _entity_id: memberId,
        _old_values: { email: userEmail },
      });

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

  const openEditDialog = (member: OrgMember) => {
    setEditingUser(member);
    setEditFullName(member.profiles.full_name || "");
    setEditPosition(member.profiles.position || "");
    setEditRole(member.role === "owner" ? "admin" : member.role);
    setEditDialogOpen(true);
  };

  const updateUser = async () => {
    if (!editingUser) return;

    if (!editFullName.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Введите ФИО пользователя",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const oldValues = {
        full_name: editingUser.profiles.full_name,
        position: editingUser.profiles.position,
        role: editingUser.role,
      };

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName.trim(),
          position: editPosition.trim() || null,
        })
        .eq("id", editingUser.user_id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editRole !== editingUser.role) {
        const { error: roleError } = await supabase
          .from("user_organizations")
          .update({ role: editRole })
          .eq("id", editingUser.id);

        if (roleError) throw roleError;
      }

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "update",
        _entity_type: "user",
        _entity_id: editingUser.id,
        _old_values: oldValues,
        _new_values: {
          full_name: editFullName.trim(),
          position: editPosition.trim() || null,
          role: editRole,
        },
      });

      toast({
        title: "Успешно",
        description: "Данные пользователя обновлены",
      });

      setEditDialogOpen(false);
      setEditingUser(null);
      fetchMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUser(member.id, member.profiles.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>
              Измените данные пользователя и его роль
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">ФИО *</Label>
              <Input
                id="edit-fullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">Должность</Label>
              <Input
                id="edit-position"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="Менеджер"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Роль *</Label>
              <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="editor">Редактор</SelectItem>
                  <SelectItem value="viewer">Наблюдатель</SelectItem>
                  <SelectItem value="member">Участник</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Отмена
            </Button>
            <Button onClick={updateUser} disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) {
          setCreatedCredentials(null);
          setCopiedField(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пользователь создан</DialogTitle>
            <DialogDescription>
              Данные для входа пользователя {createdCredentials?.fullName}. Отправьте их пользователю.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Логин (Email)</Label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.email} readOnly className="bg-muted" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.email);
                      setCopiedField("email");
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                  >
                    {copiedField === "email" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Пароль</Label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.password} readOnly className="bg-muted" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.password);
                      setCopiedField("password");
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                  >
                    {copiedField === "password" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {createdCredentials && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  const subject = encodeURIComponent("Данные для входа в CRSS");
                  const body = encodeURIComponent(
                    `Здравствуйте, ${createdCredentials.fullName}!\n\nВам предоставлен доступ к системе CRSS.\n\nДанные для входа:\nЛогин: ${createdCredentials.email}\nПароль: ${createdCredentials.password}\n\nСсылка для входа: ${window.location.origin}\n\nРекомендуем сменить пароль после первого входа.`
                  );
                  window.open(`mailto:${createdCredentials.email}?subject=${subject}&body=${body}`, "_blank");
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Отправить на email
              </Button>
            )}
            <Button onClick={() => {
              setCredentialsDialogOpen(false);
              setCreatedCredentials(null);
              setCopiedField(null);
            }}>
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
