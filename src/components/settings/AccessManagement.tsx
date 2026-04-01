import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { PERMISSION_TREE, ALL_PERMISSION_KEYS, PermissionKey } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronRight, ChevronDown, Copy, CheckCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgUser {
  user_id: string;
  role: string;
  profile: { full_name: string | null; email: string } | null;
}

interface AccessManagementProps {
  organizationId: string;
}

export const AccessManagement = ({ organizationId }: AccessManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_TREE.map(g => g.key)));
  const [copyFromUserId, setCopyFromUserId] = useState<string>("");

  // Load org users
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", organizationId);

      if (error) {
        console.error(error);
        toast({ title: "Ошибка", description: "Не удалось загрузить пользователей", variant: "destructive" });
      } else {
        const userIds = (data || []).map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const mapped = (data || []).map((row: any) => {
          const profile = profiles?.find((p) => p.id === row.user_id);
          return {
            user_id: row.user_id,
            role: row.role,
            profile: profile ? { full_name: profile.full_name, email: profile.email } : null,
          };
        });
        setUsers(mapped);
      }
      setLoading(false);
    };
    load();
  }, [organizationId]);

  // Load permissions for selected user
  useEffect(() => {
    if (!selectedUserId) {
      setPermissions({});
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission_key, allowed")
        .eq("user_id", selectedUserId)
        .eq("organization_id", organizationId);

      if (error) {
        console.error(error);
      } else {
        const perms: Record<string, boolean> = {};
        data?.forEach(row => { perms[row.permission_key] = row.allowed; });
        setPermissions(perms);
      }
    };
    load();
  }, [selectedUserId, organizationId]);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const isAdminUser = selectedUser && ["owner", "admin"].includes(selectedUser.role);

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
      // If toggling a parent, toggle all children
      const group = PERMISSION_TREE.find(g => g.key === key);
      if (group) {
        group.children.forEach(child => { next[child.key] = checked; });
      }
      // If toggling a child ON, ensure parent is ON
      if (checked) {
        const parent = key.split(".")[0];
        if (parent !== key) next[parent] = true;
      }
      // If toggling a child OFF, check if all children are off → turn parent off
      if (!checked) {
        const parent = key.split(".")[0];
        const group = PERMISSION_TREE.find(g => g.key === parent);
        if (group && group.children.every(c => c.key === key ? false : !next[c.key])) {
          next[parent] = false;
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(k => { all[k] = true; });
    setPermissions(all);
  };

  const deselectAll = () => {
    const all: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(k => { all[k] = false; });
    setPermissions(all);
  };

  const copyFromUser = async () => {
    if (!copyFromUserId) return;
    const { data, error } = await supabase
      .from("user_permissions")
      .select("permission_key, allowed")
      .eq("user_id", copyFromUserId)
      .eq("organization_id", organizationId);

    if (error) {
      toast({ title: "Ошибка", description: "Не удалось скопировать права", variant: "destructive" });
      return;
    }

    const perms: Record<string, boolean> = {};
    data?.forEach(row => { perms[row.permission_key] = row.allowed; });
    setPermissions(perms);
    toast({ title: "Права скопированы", description: "Нажмите «Сохранить» для применения" });
  };

  const savePermissions = async () => {
    if (!selectedUserId) return;
    setSaving(true);

    try {
      // Delete existing permissions for this user/org
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", selectedUserId)
        .eq("organization_id", organizationId);

      // Insert new permissions
      const rows = ALL_PERMISSION_KEYS.map(key => ({
        user_id: selectedUserId,
        organization_id: organizationId,
        permission_key: key,
        allowed: !!permissions[key],
      }));

      const { error } = await supabase
        .from("user_permissions")
        .insert(rows);

      if (error) throw error;

      toast({ title: "Сохранено", description: "Права доступа обновлены" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Ошибка", description: "Не удалось сохранить права", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      admin: "bg-primary/15 text-primary",
      editor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      viewer: "bg-muted text-muted-foreground",
      member: "bg-muted text-muted-foreground",
    };
    const labels: Record<string, string> = {
      owner: "Владелец",
      admin: "Админ",
      editor: "Редактор",
      viewer: "Наблюдатель",
      member: "Участник",
    };
    return <Badge variant="secondary" className={cn("text-xs", colors[role])}>{labels[role] || role}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const nonAdminUsers = users.filter(u => !["owner", "admin"].includes(u.role));
  const copyableUsers = nonAdminUsers.filter(u => u.user_id !== selectedUserId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Users list */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> Пользователи
        </h3>
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {users.map(u => (
            <button
              key={u.user_id}
              onClick={() => setSelectedUserId(u.user_id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                selectedUserId === u.user_id
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:bg-accent/50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.profile?.full_name || u.profile?.email || "Без имени"}
                  </p>
                  {u.profile?.full_name && (
                    <p className="text-xs text-muted-foreground truncate">{u.profile.email}</p>
                  )}
                </div>
                {getRoleBadge(u.role)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Permissions editor */}
      <div className="lg:col-span-2">
        {!selectedUserId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-16">
            Выберите пользователя для настройки прав
          </div>
        ) : isAdminUser ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-16">
            Администраторы и владельцы имеют полный доступ ко всем разделам
          </div>
        ) : (
          <div className="space-y-4">
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
                const allChildrenChecked = group.children.every(c => permissions[c.key]);
                const someChildrenChecked = group.children.some(c => permissions[c.key]);

                return (
                  <div key={group.key}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 cursor-pointer"
                      onClick={() => toggleGroup(group.key)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <Checkbox
                        checked={allChildrenChecked ? true : someChildrenChecked ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          handleToggle(group.key, !!checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm font-medium">{group.label}</span>
                    </div>
                    {isExpanded && (
                      <div className="pl-12 pb-2 space-y-1">
                        {group.children.map(child => (
                          <label
                            key={child.key}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-accent/20 rounded-md cursor-pointer"
                          >
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
  );
};
