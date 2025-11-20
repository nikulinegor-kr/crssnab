import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useCurrentOrganization";
import { useEffect, useState } from "react";

export const useUnreadMessages = () => {
  const { currentOrgId } = useCurrentOrganization();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

  const { data: totalUnread = 0 } = useQuery({
    queryKey: ["total-unread-messages", currentOrgId, currentUserId],
    queryFn: async () => {
      if (!currentOrgId || !currentUserId) return 0;

      // Получаем все беседы пользователя
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", currentOrgId);

      if (!conversations || conversations.length === 0) return 0;

      // Считаем все непрочитанные сообщения во всех беседах
      const { count } = await supabase
        .from("messages")
        .select("*", { count: 'exact', head: true })
        .in("conversation_id", conversations.map(c => c.id))
        .eq("is_read", false)
        .neq("sender_id", currentUserId);

      return count || 0;
    },
    enabled: !!currentOrgId && !!currentUserId,
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  // Подписываемся на изменения сообщений
  useEffect(() => {
    if (!currentOrgId) return;

    const channel = supabase
      .channel("unread-messages-updates")
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Invalidate query on any message change
          // This will be handled by React Query's refetch
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrgId]);

  return totalUnread;
};
