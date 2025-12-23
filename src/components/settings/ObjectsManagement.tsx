import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Building2 } from "lucide-react";

interface RequestObject {
  id: string;
  name: string;
  is_active: boolean;
  organization_id: string;
}

export const ObjectsManagement = () => {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [newObjectName, setNewObjectName] = useState("");

  const { data: objects, isLoading } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_objects")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("name");
      if (error) throw error;
      return data as RequestObject[];
    },
    enabled: !!currentOrgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrgId || !newObjectName.trim()) return;
      const { error } = await supabase.from("request_objects").insert({
        organization_id: currentOrgId,
        name: newObjectName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      setNewObjectName("");
      toast.success("Объект добавлен");
    },
    onError: () => {
      toast.error("Ошибка при добавлении объекта");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RequestObject> }) => {
      const { error } = await supabase
        .from("request_objects")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      toast.success("Объект обновлён");
    },
    onError: () => {
      toast.error("Ошибка при обновлении объекта");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("request_objects")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      toast.success("Объект удалён");
    },
    onError: () => {
      toast.error("Ошибка при удалении объекта");
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Загрузка...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Объекты
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Название объекта"
            value={newObjectName}
            onChange={(e) => setNewObjectName(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!newObjectName.trim() || addMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

        <div className="space-y-2">
          {objects?.map((obj) => (
            <div
              key={obj.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <Input
                value={obj.name}
                onChange={(e) =>
                  updateMutation.mutate({
                    id: obj.id,
                    updates: { name: e.target.value },
                  })
                }
                className="flex-1"
              />
              <Switch
                checked={obj.is_active}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({
                    id: obj.id,
                    updates: { is_active: checked },
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(obj.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {objects?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Объекты не добавлены
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
