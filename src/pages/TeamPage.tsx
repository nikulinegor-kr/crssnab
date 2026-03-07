import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const roleLabels: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  editor: "Редактор",
  viewer: "Наблюдатель",
  member: "Участник",
};

const TeamPage = () => {
  const { currentOrgId } = useCurrentOrganization();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Команда</h1>
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
    </div>
  );
};

export default TeamPage;
