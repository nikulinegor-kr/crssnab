import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Loader2, Clock, Save, AlertTriangle } from "lucide-react";

interface DeadlineSettings {
  id: string;
  organization_id: string;
  days_before: number;
  is_enabled: boolean;
  notify_executor: boolean;
  notify_applicant: boolean;
}

export function DeadlineReminderSettings() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [daysBeforeInput, setDaysBeforeInput] = useState("3");
  const [isEnabled, setIsEnabled] = useState(true);
  const [notifyExecutor, setNotifyExecutor] = useState(true);
  const [notifyApplicant, setNotifyApplicant] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["deadline-reminder-settings", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return null;
      
      const { data, error } = await supabase
        .from("deadline_reminder_settings")
        .select("*")
        .eq("organization_id", currentOrgId)
        .maybeSingle();
      
      if (error) throw error;
      return data as DeadlineSettings | null;
    },
    enabled: !!currentOrgId,
  });

  // Update state when settings load
  useEffect(() => {
    if (settings) {
      setDaysBeforeInput(settings.days_before.toString());
      setIsEnabled(settings.is_enabled);
      setNotifyExecutor(settings.notify_executor);
      setNotifyApplicant(settings.notify_applicant);
    }
  }, [settings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("No organization selected");
      
      const daysBefore = parseInt(daysBeforeInput) || 3;
      
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from("deadline_reminder_settings")
          .update({
            days_before: daysBefore,
            is_enabled: isEnabled,
            notify_executor: notifyExecutor,
            notify_applicant: notifyApplicant,
          })
          .eq("id", settings.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("deadline_reminder_settings")
          .insert({
            organization_id: currentOrgId,
            days_before: daysBefore,
            is_enabled: isEnabled,
            notify_executor: notifyExecutor,
            notify_applicant: notifyApplicant,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadline-reminder-settings", currentOrgId] });
      toast({ title: "Настройки сохранены" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });

  // Test notification
  const testMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("check-deadline-reminders");
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Проверка выполнена", description: "Уведомления о дедлайнах обновлены" });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось выполнить проверку",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border/40">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Автонапоминания о дедлайнах
        </CardTitle>
        <CardDescription>
          Настройте автоматические напоминания о приближающихся дедлайнах заявок
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled" className="text-base">Включить напоминания</Label>
            <p className="text-sm text-muted-foreground">
              Автоматически уведомлять о приближающихся дедлайнах
            </p>
          </div>
          <Switch
            id="enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Days before */}
        <div className="space-y-2">
          <Label htmlFor="days" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            За сколько дней напоминать
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="days"
              type="number"
              min="1"
              max="30"
              value={daysBeforeInput}
              onChange={(e) => setDaysBeforeInput(e.target.value)}
              className="w-24"
              disabled={!isEnabled}
            />
            <span className="text-sm text-muted-foreground">дней до дедлайна</span>
          </div>
        </div>

        {/* Notification targets */}
        <div className="space-y-3">
          <Label className="text-base">Кого уведомлять</Label>
          
          <div className="flex items-center justify-between pl-4">
            <div className="space-y-0.5">
              <Label htmlFor="notify-executor" className="font-normal">Исполнителя заявки</Label>
              <p className="text-xs text-muted-foreground">
                Напоминание получит назначенный исполнитель
              </p>
            </div>
            <Switch
              id="notify-executor"
              checked={notifyExecutor}
              onCheckedChange={setNotifyExecutor}
              disabled={!isEnabled}
            />
          </div>

          <div className="flex items-center justify-between pl-4">
            <div className="space-y-0.5">
              <Label htmlFor="notify-applicant" className="font-normal">Создателя заявки</Label>
              <p className="text-xs text-muted-foreground">
                Напоминание получит тот, кто создал заявку
              </p>
            </div>
            <Switch
              id="notify-applicant"
              checked={notifyApplicant}
              onCheckedChange={setNotifyApplicant}
              disabled={!isEnabled}
            />
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Напоминания проверяются ежедневно. Уведомления создаются для заявок, 
            у которых указана дата доставки (дедлайн) и статус не «Доставлено».
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Сохранить настройки
          </Button>
          
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !isEnabled}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            Проверить сейчас
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
