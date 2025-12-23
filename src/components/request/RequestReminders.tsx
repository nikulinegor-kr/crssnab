import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, Plus, X, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface RequestRemindersProps {
  requestId: string;
}

export function RequestReminders({ requestId }: RequestRemindersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["request-reminders", requestId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("request_reminders")
        .select("*")
        .eq("request_id", requestId)
        .eq("user_id", user.id)
        .order("remind_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!requestId,
  });

  const addReminderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("request_reminders")
        .insert({
          request_id: requestId,
          user_id: user.id,
          remind_at: new Date(remindAt).toISOString(),
          message: message || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-reminders", requestId] });
      setDialogOpen(false);
      setRemindAt("");
      setMessage("");
      toast({ title: "Напоминание создано" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать напоминание",
        variant: "destructive",
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from("request_reminders")
        .delete()
        .eq("id", reminderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-reminders", requestId] });
      toast({ title: "Напоминание удалено" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (remindAt) {
      addReminderMutation.mutate();
    }
  };

  const isPast = (date: string) => new Date(date) < new Date();

  return (
    <Card className="glassmorphism">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Напоминания ({reminders?.filter(r => !r.is_sent).length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reminders?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет напоминаний
          </p>
        ) : (
          <div className="space-y-2">
            {reminders?.map((reminder) => (
              <div
                key={reminder.id}
                className={`flex items-start justify-between p-3 rounded-lg transition-colors ${
                  reminder.is_sent || isPast(reminder.remind_at)
                    ? "bg-muted/20 opacity-60"
                    : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Clock className={`h-4 w-4 mt-0.5 ${
                    isPast(reminder.remind_at) ? "text-muted-foreground" : "text-primary"
                  }`} />
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(reminder.remind_at), "dd.MM.yyyy, HH:mm", { locale: ru })}
                    </p>
                    {reminder.message && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {reminder.message}
                      </p>
                    )}
                    {reminder.is_sent && (
                      <span className="text-xs text-muted-foreground">Отправлено</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => deleteReminderMutation.mutate(reminder.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать напоминание</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Дата и время напоминания</Label>
                <Input
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Сообщение (опционально)</Label>
                <Textarea
                  placeholder="О чём напомнить..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!remindAt || addReminderMutation.isPending}
              >
                {addReminderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Создать напоминание
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
