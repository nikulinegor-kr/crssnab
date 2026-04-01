import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PERMISSION_TREE, ALL_PERMISSION_KEYS, PermissionKey } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, ChevronRight, ChevronDown, Copy, CheckCheck, Users, Plus, Trash2,
  Pencil, UserPlus, Shield, Check, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Неверный формат email" }).max(255);
const passwordSchema = z.string().min(6, { message: "Пароль минимум 6 символов" });

interface OrgUser {
  id: string; // user_organizations row id
  user_id: string;
  role: string;
  profile: { full_name: string | null; email: string; position?: string | null } | null;
}

interface AccessManagementProps {
  organizationId: string;
}

const roleLabels: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  editor: "Редактор",
  viewer: "Наблюдатель",
  member: "Участник",
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  admin: "bg-primary/15 text-primary",
  editor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
  member: "bg-muted text-muted-foreground",
};

export const AccessManagement = ({ organizationId }: AccessManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_TREE.map(g => g.key)));
  const [copyFromUserId, setCopyFromUserId] = useState<string>("");

  // Add user dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isCreating, setIsCreating] = useState(false);

  // Credentials dialog
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; fullName: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit role dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editRole, setEditRole] = useState<string>("viewer");
  const [isUpdating, setIsUpdating] = useState(false);

  // Load org users
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_organizations")
      .select("id, user_id, role")
      .eq("organization_id", organizationId);

    if (error) {
      toast({ title: "Ошибка", description: "Не удалось загрузить пользователей", variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = (data || []).map((m) => m.user_id);
    if (userIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, position")
      .in("id", userIds);

    const mapped = (data || []).map((row) => {
      const profile = profiles?.find((p) => p.id === row.user_id);
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        profile: profile ? { full_name: profile.full_name, email: profile.email, position: profile.position } : null,
      };
    });
    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [organizationId]);

  // Load permissions for selected user
  useEffect(() => {
    if (!selectedUserId) { setPermissions({}); return; }
    const load = async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("permission_key, allowed")
        .eq("user_id", selectedUserId)
        .eq("organization_id", organizationId);
      const perms: Record<string, boolean> = {};
      data?.forEach(row => { perms[row.permission_key] = row.allowed; });
      setPermissions(perms);
    };
    load();
  }, [selectedUserId, organizationId]);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const isAdminUser = selectedUser && ["owner", "admin"].includes(selectedUser.role);

  // --- Add user ---
  const addUser = async () => {
    const emailVal = emailSchema.safeParse(newEmail);
    if (!emailVal.success) { toast({ variant: "destructive", title: "Ошибка", description: emailVal.error.errors[0].message }); return; }
    const passVal = passwordSchema.safeParse(newPassword);
    if (!passVal.success) { toast({ variant: "destructive", title: "Ошибка", description: passVal.error.errors[0].message }); return; }
    if (!newFullName.trim()) { toast({ variant: "destructive", title: "Ошибка", description: "Введите ФИО" }); return; }

    setIsCreating(true);
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations").select("name").eq("id", organizationId).single();
      if (orgError) throw orgError;

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: emailVal.data, password: newPassword,
          fullName: newFullName.trim(), position: newPosition.trim() || null,
          organizationId, organizationName: orgData.name, role: newRole,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Не удалось создать пользователя");

      setCreatedCredentials({ email: emailVal.data, password: newPassword, fullName: newFullName.trim() });
      setCredentialsDialogOpen(true);
      setAddDialogOpen(false);
      setNewEmail(""); setNewPassword(""); setNewFullName(""); setNewPosition(""); setNewRole("viewer");
      toast({ title: "Успешно", description: "Пользователь добавлен" });
      fetchUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err.message });
    } finally { setIsCreating(false); }
  };

  // --- Remove user ---
  const removeUser = async (user: OrgUser) => {
    const name = user.profile?.full_name || user.profile?.email || "пользователя";
    if (!confirm(`Удалить ${name}?`)) return;
    try {
      const { error } = await supabase.from("user_organizations").delete().eq("id", user.id);
      if (error) throw error;
      toast({ title: "Успешно", description: "Пользователь удалён" });
      if (selectedUserId === user.user_id) setSelectedUserId(null);
      fetchUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err.message });
    }
  };

  // --- Edit user ---
  const openEdit = (user: OrgUser) => {
    setEditingUser(user);
    setEditFullName(user.profile?.full_name || "");
    setEditPosition(user.profile?.position || "");
    setEditRole(user.role === "owner" ? "admin" : user.role);
    setEditDialogOpen(true);
  };

  const updateUser = async () => {
    if (!editingUser || !editFullName.trim()) return;
    setIsUpdating(true);
    try {
      await supabase.from("profiles").update({
        full_name: editFullName.trim(),
        position: editPosition.trim() || null,
      }).eq("id", editingUser.user_id);

      if (editRole !== editingUser.role as string) {
        await supabase.from("user_organizations").update({ role: editRole }).eq("id", editingUser.id);
      }

      toast({ title: "Сохранено", description: "Данные обновлены" });
      setEditDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err.message });
    } finally { setIsUpdating(false); }
  };

  // --- Permissions logic ---
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleToggle = (key: PermissionKey, checked: boolean) => {
    setPermissions(prev => {
      const next = { ...prev, [key]: checked };
      const group = PERMISSION_TREE.find(g => g.key === key);
      if (group) group.children.forEach(child => { next[child.key] = checked; });
      if (checked) { const parent = key.split(".")[0]; if (parent !== key) next[parent] = true; }
      if (!checked) {
        const parent = key.split(".")[0];
        const grp = PERMISSION_TREE.find(g => g.key === parent);
        if (grp && grp.children.every(c => c.key === key ? false : !next[c.key])) next[parent] = false;
      }
      return next;
    });
  };

  const selectAll = () => { const all: Record<string, boolean> = {}; ALL_PERMISSION_KEYS.forEach(k => { all[k] = true; }); setPermissions(all); };
  const deselectAll = () => { const all: Record<string, boolean> = {}; ALL_PERMISSION_KEYS.forEach(k => { all[k] = false; }); setPermissions(all); };

  const copyFromUser = async () => {
    if (!copyFromUserId) return;
    const { data } = await supabase.from("user_permissions").select("permission_key, allowed")
      .eq("user_id", copyFromUserId).eq("organization_id", organizationId);
    if (!data) { toast({ title: "Ошибка", variant: "destructive" }); return; }
    const perms: Record<string, boolean> = {};
    data.forEach(row => { perms[row.permission_key] = row.allowed; });
    setPermissions(perms);
    toast({ title: "Права скопированы", description: "Нажмите «Сохранить» для применения" });
  };

  const savePermissions = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await supabase.from("user_permissions").delete()
        .eq("user_id", selectedUserId).eq("organization_id", organizationId);
      const rows = ALL_PERMISSION_KEYS.map(key => ({
        user_id: selectedUserId, organization_id: organizationId,
        permission_key: key, allowed: !!permissions[key],
      }));
      const { error } = await supabase.from("user_permissions").insert(rows);
      if (error) throw error;
      toast({ title: "Сохранено", description: "Права доступа обновлены" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: "Не удалось сохранить права", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const getInitials = (user: OrgUser) =>
    (user.profile?.full_name || user.profile?.email || "?")
      .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const copyableUsers = users.filter(u => !["owner", "admin"].includes(u.role) && u.user_id !== selectedUserId);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Выберите пользователя для настройки роли и прав доступа</p>
        <Button onClick={() => setAddDialogOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users list */}
        <div className="lg:col-span-1 space-y-1 max-h-[650px] overflow-y-auto">
          {users.map(u => (
            <div
              key={u.user_id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors group",
                selectedUserId === u.user_id
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:bg-accent/50"
              )}
              onClick={() => setSelectedUserId(u.user_id)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(u)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.profile?.full_name || u.profile?.email || "Без имени"}</p>
                {u.profile?.position && <p className="text-xs text-muted-foreground truncate">{u.profile.position}</p>}
              </div>
              <Badge variant="secondary" className={cn("text-xs shrink-0", roleBadgeColors[u.role])}>
                {roleLabels[u.role] || u.role}
              </Badge>
              {u.role !== "owner" && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(u); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeUser(u); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right panel: role + permissions */}
        <div className="lg:col-span-2">
          {!selectedUserId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-16 gap-2">
              <Shield className="h-8 w-8 opacity-40" />
              Выберите пользователя для настройки прав
            </div>
          ) : isAdminUser ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-16 gap-2">
              <Shield className="h-8 w-8 opacity-40" />
              Администраторы и владельцы имеют полный доступ ко всем разделам
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Выбрать всё
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Снять всё
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={copyFromUserId} onValueChange={setCopyFromUserId}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Копировать с…" />
                    </SelectTrigger>
                    <SelectContent>
                      {copyableUsers.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.profile?.full_name || u.profile?.email || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={copyFromUser} disabled={!copyFromUserId}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Копировать
                  </Button>
                </div>
              </div>

              {/* Permission tree */}
              <div className="border rounded-lg divide-y">
                {PERMISSION_TREE.map(group => {
                  const isExpanded = expandedGroups.has(group.key);
                  const allChecked = group.children.every(c => permissions[c.key]);
                  const someChecked = group.children.some(c => permissions[c.key]);

                  return (
                    <div key={group.key}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 cursor-pointer"
                        onClick={() => toggleGroup(group.key)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <Checkbox
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={(checked) => handleToggle(group.key, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-medium">{group.label}</span>
                      </div>
                      {isExpanded && (
                        <div className="pl-12 pb-2 space-y-1">
                          {group.children.map(child => (
                            <label key={child.key} className="flex items-center gap-3 px-4 py-2 hover:bg-accent/20 rounded-md cursor-pointer">
                              <Checkbox
                                checked={!!permissions[child.key]}
                                onCheckedChange={(checked) => handleToggle(child.key, !!checked)}
                              />
                              <span className="text-sm">{child.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button onClick={savePermissions} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Добавить участника</DialogTitle>
            <DialogDescription>Создайте учётную запись для нового члена команды</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ФИО *</Label>
              <Input placeholder="Иванов Иван Иванович" value={newFullName} onChange={e => setNewFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="user@company.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Пароль *</Label>
              <Input type="password" placeholder="Минимум 6 символов" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Должность</Label>
              <Input placeholder="Менеджер" value={newPosition} onChange={e => setNewPosition(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="editor">Редактор</SelectItem>
                  <SelectItem value="viewer">Наблюдатель</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Отмена</Button>
            <Button onClick={addUser} disabled={isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />} Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>Измените данные и роль</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ФИО *</Label>
              <Input value={editFullName} onChange={e => setEditFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Должность</Label>
              <Input value={editPosition} onChange={e => setEditPosition(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isUpdating}>Отмена</Button>
            <Button onClick={updateUser} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialogOpen} onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) { setCreatedCredentials(null); setCopiedField(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пользователь создан</DialogTitle>
            <DialogDescription>Данные для входа {createdCredentials?.fullName}. Отправьте их пользователю.</DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Логин (Email)</Label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.email} readOnly className="bg-muted" />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(createdCredentials.email); setCopiedField("email"); setTimeout(() => setCopiedField(null), 2000); }}>
                    {copiedField === "email" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Пароль</Label>
                <div className="flex items-center gap-2">
                  <Input value={createdCredentials.password} readOnly className="bg-muted" />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(createdCredentials.password); setCopiedField("password"); setTimeout(() => setCopiedField(null), 2000); }}>
                    {copiedField === "password" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {createdCredentials && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
                const subject = encodeURIComponent("Данные для входа");
                const body = encodeURIComponent(`Здравствуйте, ${createdCredentials.fullName}!\n\nДанные для входа:\nЛогин: ${createdCredentials.email}\nПароль: ${createdCredentials.password}\n\nСсылка: ${window.location.origin}`);
                window.open(`mailto:${createdCredentials.email}?subject=${subject}&body=${body}`, "_blank");
              }}>
                <Mail className="mr-2 h-4 w-4" /> Отправить на email
              </Button>
            )}
            <Button onClick={() => { setCredentialsDialogOpen(false); setCreatedCredentials(null); setCopiedField(null); }}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
