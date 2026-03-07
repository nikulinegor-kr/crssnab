import { useState } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roleLabels: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  editor: "Редактор",
  viewer: "Наблюдатель",
  member: "Участник",
};

const TeamPage = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add user dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isCreating, setIsCreating] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", currentOrgId);
      if (error) throw error;

      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, position")
        .in("id", userIds);

      return data.map((m) => {
        const profile = profiles?.find((p) => p.id === m.user_id);
        return { ...m, ...profile };
      });
    },
    enabled: !!currentOrgId,
  });

  const handleAddUser = async () => {
    if (!email.trim() || !password || !fullName.trim() || !currentOrgId) {
      toast({ variant: "destructive", title: "Ошибка", description: "Заполните все обязательные поля" });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Ошибка", description: "Пароль минимум 6 символов" });
      return;
    }

    setIsCreating(true);
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", currentOrgId)
        .single();
      if (orgError) throw orgError;

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          position: position.trim() || null,
          organizationId: currentOrgId,
          organizationName: orgData.name,
          role,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Не удалось создать пользователя");

      toast({ title: "Успешно", description: "Пользователь добавлен в команду" });
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setPosition("");
      setRole("viewer");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Команда</h1>
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const initials = (member.full_name || member.email || "?")
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <Card key={member.user_id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.full_name || member.email}</p>
                  {member.position && (
                    <p className="text-sm text-muted-foreground truncate">{member.position}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {roleLabels[member.role] || member.role}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Добавить участника
            </DialogTitle>
            <DialogDescription>
              Создайте учётную запись для нового члена команды
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ФИО *</Label>
              <Input
                placeholder="Иванов Иван Иванович"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Пароль *</Label>
              <Input
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Должность</Label>
              <Input
                placeholder="Менеджер"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="editor">Редактор</SelectItem>
                  <SelectItem value="viewer">Наблюдатель</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddUser} disabled={isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamPage;
