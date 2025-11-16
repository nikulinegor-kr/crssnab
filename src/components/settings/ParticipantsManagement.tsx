import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Participant {
  id: string;
  name: string;
  participant_type: "applicant" | "executor";
  is_active: boolean;
  created_at: string;
}

export function ParticipantsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrgId } = useCurrentOrganization();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantType, setNewParticipantType] = useState<"applicant" | "executor">("applicant");

  // Fetch participants
  const { data: participants, isLoading } = useQuery({
    queryKey: ["request-participants", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_participants")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("is_active", true)
        .order("participant_type")
        .order("name");

      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!currentOrgId,
  });

  // Add participant mutation
  const addMutation = useMutation({
    mutationFn: async (data: { name: string; type: "applicant" | "executor" }) => {
      if (!currentOrgId) throw new Error("No organization selected");

      const { error } = await supabase
        .from("request_participants")
        .insert({
          organization_id: currentOrgId,
          name: data.name.trim(),
          participant_type: data.type,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
      toast({
        title: "Успешно",
        description: "Участник добавлен",
      });
      setIsAddDialogOpen(false);
      setNewParticipantName("");
      setNewParticipantType("applicant");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить участника",
        variant: "destructive",
      });
    },
  });

  // Update participant mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; type: "applicant" | "executor" }) => {
      const { error } = await supabase
        .from("request_participants")
        .update({
          name: data.name.trim(),
          participant_type: data.type,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
      toast({
        title: "Успешно",
        description: "Участник обновлен",
      });
      setEditingParticipant(null);
      setNewParticipantName("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить участника",
        variant: "destructive",
      });
    },
  });

  // Delete participant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("request_participants")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-participants"] });
      toast({
        title: "Успешно",
        description: "Участник удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить участника",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!newParticipantName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите имя участника",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      name: newParticipantName,
      type: newParticipantType,
    });
  };

  const handleUpdate = () => {
    if (!editingParticipant || !newParticipantName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите имя участника",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      id: editingParticipant.id,
      name: newParticipantName,
      type: newParticipantType,
    });
  };

  const openEditDialog = (participant: Participant) => {
    setEditingParticipant(participant);
    setNewParticipantName(participant.name);
    setNewParticipantType(participant.participant_type);
  };

  const applicants = participants?.filter((p) => p.participant_type === "applicant") || [];
  const executors = participants?.filter((p) => p.participant_type === "executor") || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Заявители</CardTitle>
          <CardDescription>
            Управление списком заявителей для создания заявок
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={() => {
                setNewParticipantName("");
                setNewParticipantType("applicant");
                setIsAddDialogOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить заявителя
            </Button>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : applicants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Заявители не добавлены</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>{participant.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(participant)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(participant.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Исполнители</CardTitle>
          <CardDescription>
            Управление списком исполнителей для создания заявок
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={() => {
                setNewParticipantName("");
                setNewParticipantType("executor");
                setIsAddDialogOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить исполнителя
            </Button>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : executors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Исполнители не добавлены</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executors.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>{participant.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(participant)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(participant.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingParticipant}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingParticipant(null);
            setNewParticipantName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingParticipant ? "Редактировать участника" : "Добавить участника"}
            </DialogTitle>
            <DialogDescription>
              {editingParticipant
                ? "Внесите изменения в данные участника"
                : "Добавьте нового заявителя или исполнителя"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Введите имя"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Тип</Label>
              <Select
                value={newParticipantType}
                onValueChange={(value: "applicant" | "executor") =>
                  setNewParticipantType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">Заявитель</SelectItem>
                  <SelectItem value="executor">Исполнитель</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingParticipant(null);
                setNewParticipantName("");
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={editingParticipant ? handleUpdate : handleAdd}
              disabled={addMutation.isPending || updateMutation.isPending}
            >
              {editingParticipant ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
