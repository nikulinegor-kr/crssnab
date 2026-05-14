import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useToast } from "./use-toast";
import { useEffect, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Локальный лог последних push-уведомлений (для UI настроек)
const PUSH_LOG_KEY = "crss-push-log-v1";
const PUSH_SOUND_KEY = "crss-push-sound";
const PUSH_BROWSER_ENABLED_KEY = "crss-push-browser-enabled";

export const appendPushLog = (entry: { title: string; body: string; link?: string | null }) => {
  try {
    const raw = localStorage.getItem(PUSH_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ ...entry, ts: new Date().toISOString() });
    localStorage.setItem(PUSH_LOG_KEY, JSON.stringify(log.slice(0, 30)));
  } catch (_) { /* noop */ }
};

const playNotificationSound = () => {
  if (localStorage.getItem(PUSH_SOUND_KEY) === "off") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.36);
  } catch (_) { /* noop */ }
};

const showBrowserNotification = async (title: string, body: string, link?: string | null) => {
  if (localStorage.getItem(PUSH_BROWSER_ENABLED_KEY) === "off") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  appendPushLog({ title, body, link });
  playNotificationSound();

  const url = link || "/dashboard";
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.active?.postMessage({
          type: "show-notification",
          title,
          body,
          url,
          tag: link || undefined,
          icon: "/favicon.png",
          badge: "/favicon.png",
        });
        return;
      }
    }
    // Fallback: прямой Notification API (откроется/сфокусируется текущая вкладка)
    const n = new Notification(title, { body, icon: "/favicon.png", tag: link || undefined });
    n.onclick = () => { window.focus(); window.location.href = url; n.close(); };
  } catch (error) {
    console.error("Error showing browser notification:", error);
  }
};

export const useNotifications = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получаем уведомления пользователя
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", currentOrgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!currentOrgId,
  });

  // Подписываемся на новые уведомления
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            
            // Показываем toast уведомление
            const notification = payload.new as Notification;
            toast({
              title: notification.title,
              description: notification.message,
            });

            // Показываем браузерное push-уведомление
            showBrowserNotification(notification.title, notification.message, notification.link);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    getCurrentUser();
  }, [currentOrgId, queryClient, toast]);

  // Отметить уведомление как прочитанное
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Отметить все как прочитанные
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("organization_id", currentOrgId)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
};

// Функция для создания уведомления
export const createNotification = async ({
  userId,
  organizationId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) => {
  const { error } = await supabase
    .from("notifications")
    .insert([{
      user_id: userId,
      organization_id: organizationId,
      type,
      title,
      message,
      link: link || null,
    }]);

  if (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};
