import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useAuthUserId } from "@/hooks/useOrgMembership";
import { invalidatePlannerTaskQueries } from "@/hooks/usePlannerTasks";
import { normalizeNotificationLink } from "@/lib/notificationLinks";
import type { Notification } from "@/hooks/useNotifications";
import { toast } from "sonner";

export function TaskAssignmentNotice() {
  const { currentOrgId } = useCurrentOrganization();
  const { data: userId } = useAuthUserId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: notices = [] } = useQuery({
    queryKey: ["task-assignment-notices", userId, currentOrgId],
    enabled: Boolean(userId && currentOrgId),
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*")
        .eq("user_id", userId!).eq("organization_id", currentOrgId!)
        .eq("type", "task_assigned").eq("is_read", false)
        .order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const accept = async (notification: Notification) => {
    if (!userId || !currentOrgId || pendingId) return;
    setPendingId(notification.id);
    try {
      const link = normalizeNotificationLink(notification.link);
      const taskId = new URL(link, window.location.origin).searchParams.get("task");
      if (!taskId) throw new Error("Не удалось определить задачу");
      const { error: taskError } = await supabase.from("planner_tasks")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", taskId).eq("organization_id", currentOrgId).eq("assignee_id", userId);
      if (taskError) throw taskError;
      const { error: noticeError } = await supabase.from("notifications")
        .update({ is_read: true }).eq("id", notification.id).eq("user_id", userId);
      if (noticeError) throw noticeError;
      invalidatePlannerTaskQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["task-assignment-notices"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Задача принята");
      navigate(link);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось принять задачу");
    } finally { setPendingId(null); }
  };

  if (!notices.length) return null;
  return <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,380px)] space-y-3">
    {notices.map(notice => <Card key={notice.id} className="border-primary/30 shadow-xl">
      <CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{notice.title}</CardTitle><Badge>Новая задача</Badge></div></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{notice.message}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => notice.link && navigate(normalizeNotificationLink(notice.link))}>Открыть</Button><Button size="sm" disabled={pendingId !== null} onClick={() => void accept(notice)}><CheckCircle2 className="mr-1 h-4 w-4" />Принять задачу</Button></div></CardContent>
    </Card>)}
  </div>;
}
