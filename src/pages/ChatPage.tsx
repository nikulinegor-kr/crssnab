import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Users, MessageCircle, Paperclip, X, Download, FileIcon, Trash2, Pin, Search, Forward } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { DeleteChatDialog } from "@/components/DeleteChatDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Conversation {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
  pinned: boolean;
}

interface MessageAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  conversation_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
    position: string | null;
  };
  attachments?: MessageAttachment[];
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  position: string | null;
}

interface ConversationParticipant {
  user_id: string;
  conversation_id: string;
}

export default function ChatPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const totalUnread = useUnreadMessages();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [chatType, setChatType] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardToConversation, setForwardToConversation] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

  // Настройка presence для индикатора печатания
  useEffect(() => {
    if (!selectedConversation || !currentUserId) return;

    const channel = supabase.channel(`typing:${selectedConversation}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = new Set<string>();
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id !== currentUserId && presence.typing) {
              typing.add(presence.user_id);
            }
          });
        });
        
        setTypingUsers(prev => ({ ...prev, [selectedConversation]: typing }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, currentUserId]);

  // Получаем беседы
  const { data: conversations } = useQuery({
    queryKey: ["conversations", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!currentOrgId,
  });

  // Получаем участников бесед
  const { data: conversationParticipants } = useQuery({
    queryKey: ["conversation-participants", currentOrgId],
    queryFn: async () => {
      if (!conversations) return [];
      
      const conversationIds = conversations.map(c => c.id);
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("user_id, conversation_id")
        .in("conversation_id", conversationIds);

      if (error) throw error;
      return data as ConversationParticipant[];
    },
    enabled: !!currentOrgId && !!conversations && conversations.length > 0,
  });

  // Получаем количество непрочитанных сообщений
  const { data: unreadCounts } = useQuery({
    queryKey: ["unread-counts", currentOrgId, currentUserId],
    queryFn: async () => {
      if (!conversations || !currentUserId) return {};
      
      const counts: Record<string, number> = {};
      
      for (const conv of conversations) {
        const { count, error } = await supabase
          .from("messages")
          .select("*", { count: 'exact', head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", currentUserId);
        
        if (!error && count) {
          counts[conv.id] = count;
        }
      }
      
      return counts;
    },
    enabled: !!currentOrgId && !!currentUserId && !!conversations && conversations.length > 0,
  });

  // Получаем сообщения выбранной беседы
  const { data: messages } = useQuery({
    queryKey: ["messages", selectedConversation],
    queryFn: async () => {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Получаем профили отправителей
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, position")
        .in("id", senderIds);

      if (profilesError) throw profilesError;

      // Получаем вложения для сообщений
      const messageIds = messagesData.map(m => m.id);
      const { data: attachmentsData } = await supabase
        .from("message_attachments")
        .select("*")
        .in("message_id", messageIds);

      // Объединяем данные
      const messagesWithProfiles = messagesData.map(msg => ({
        ...msg,
        profiles: profilesData?.find(p => p.id === msg.sender_id) || null,
        attachments: attachmentsData?.filter(a => a.message_id === msg.id) || []
      }));

      return messagesWithProfiles as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Получаем пользователей организации
  const { data: orgUsers } = useQuery({
    queryKey: ["org-users-chat", currentOrgId],
    queryFn: async () => {
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", currentOrgId);

      if (userOrgsError) throw userOrgsError;
      
      const userIds = userOrgs?.map(uo => uo.user_id) || [];
      
      if (userIds.length === 0) return [];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, position")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return profilesData as Profile[];
    },
    enabled: !!currentOrgId,
  });

  // Подписываемся на новые сообщения
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages:${selectedConversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation] });
          queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, queryClient]);

  // Помечаем сообщения как прочитанные когда открывается беседа
  useEffect(() => {
    if (!selectedConversation || !currentUserId) return;

    const markAsRead = async () => {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedConversation)
        .eq("is_read", false)
        .neq("sender_id", currentUserId);
      
      // Обновляем счетчики
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    };

    markAsRead();
  }, [selectedConversation, currentUserId, queryClient]);

  // Создаем уведомления для новых сообщений
  useEffect(() => {
    if (!currentOrgId || !currentUserId) return;

    const channel = supabase
      .channel('new-messages-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Не создаем уведомление для собственных сообщений
          if (newMessage.sender_id === currentUserId) return;
          
          // Проверяем, участвует ли текущий пользователь в этой беседе
          const { data: participant } = await supabase
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', newMessage.conversation_id)
            .eq('user_id', currentUserId)
            .single();
          
          if (!participant) return;
          
          // Получаем информацию об отправителе
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', newMessage.sender_id)
            .single();
          
          // Получаем информацию о беседе
          const { data: conversation } = await supabase
            .from('conversations')
            .select('name, type')
            .eq('id', newMessage.conversation_id)
            .single();
          
          const senderName = sender?.full_name || sender?.email || 'Пользователь';
          const conversationName = conversation?.name || 'Личный чат';
          
          // Создаем уведомление
          await supabase
            .from('notifications')
            .insert({
              user_id: currentUserId,
              organization_id: currentOrgId,
              type: 'chat_message',
              title: `Новое сообщение от ${senderName}`,
              message: newMessage.content.substring(0, 100),
              link: `/chat?conversation=${newMessage.conversation_id}`
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrgId, currentUserId]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Создание беседы
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) throw new Error("User not authenticated");
      
      // Создаем беседу
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert([{
          organization_id: currentOrgId,
          type: chatType,
          name: chatType === "group" ? groupName : null,
          created_by: user.id
        }])
        .select()
        .single();

      if (convError) throw convError;

      // Добавляем участников
      const participants = [
        { conversation_id: conversation.id, user_id: user.id },
        ...selectedUsers.map(userId => ({
          conversation_id: conversation.id,
          user_id: userId
        }))
      ];

      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      return conversation;
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setIsNewChatOpen(false);
      setSelectedConversation(conversation.id);
      setSelectedUsers([]);
      setGroupName("");
      toast({
        title: "Беседа создана",
        description: "Новая беседа успешно создана",
      });
    },
    onError: (error) => {
      console.error("Error creating conversation:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать беседу. Попробуйте еще раз.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && selectedFiles.length === 0) || !selectedConversation) return;
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error("User not authenticated");

      // Создаем сообщение
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert([{
          conversation_id: selectedConversation,
          sender_id: user.user.id,
          content: messageText || "📎 Файл"
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Загружаем файлы если есть
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${selectedConversation}/${fileName}`;

          // Загружаем файл в storage
          const { error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Получаем публичный URL
          const { data: { publicUrl } } = supabase.storage
            .from('chat-files')
            .getPublicUrl(filePath);

          // Сохраняем информацию о файле
          const { error: attachmentError } = await supabase
            .from('message_attachments')
            .insert({
              message_id: message.id,
              file_name: file.name,
              file_url: publicUrl,
              file_type: file.type,
              file_size: file.size
            });

          if (attachmentError) throw attachmentError;
        }
      }

      setMessageText("");
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
      
      toast({
        title: "Сообщение отправлено",
        description: selectedFiles.length > 0 ? `Отправлено с ${selectedFiles.length} файл(ов)` : undefined,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast({
        title: "Слишком много файлов",
        description: "Можно прикрепить не более 10 файлов",
        variant: "destructive",
      });
      return;
    }

    const invalidFiles = files.filter(f => f.size > 20 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла 20 МБ",
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateConversation = () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы одного пользователя",
        variant: "destructive",
      });
      return;
    }

    if (chatType === "group" && !groupName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название группы",
        variant: "destructive",
      });
      return;
    }

    createConversationMutation.mutate();
  };

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      // Удаляем сообщения
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (messagesError) throw messagesError;
      
      // Удаляем участников
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (participantsError) throw participantsError;
      
      // Удаляем беседу
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (conversationError) throw conversationError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedConversation === chatToDelete) {
        setSelectedConversation(null);
      }
      setChatToDelete(null);
      toast({
        title: "Беседа удалена",
        description: "Беседа успешно удалена",
      });
    },
    onError: (error) => {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить беседу",
        variant: "destructive",
      });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ pinned: !pinned })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Готово",
        description: "Статус закрепления изменен",
      });
    },
    onError: (error) => {
      console.error("Error toggling pin:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус закрепления",
        variant: "destructive",
      });
    },
  });

  const forwardMessageMutation = useMutation({
    mutationFn: async ({ messageId, toConversationId }: { messageId: string; toConversationId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error("User not authenticated");

      // Получаем оригинальное сообщение
      const { data: originalMessage, error: fetchError } = await supabase
        .from('messages')
        .select('content')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      // Создаем новое сообщение в целевой беседе
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: toConversationId,
          sender_id: user.user.id,
          content: `📤 Пересланное: ${originalMessage.content}`
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setForwardMessageId(null);
      setForwardToConversation(null);
      toast({
        title: "Сообщение переслано",
        description: "Сообщение успешно переслано",
      });
    },
    onError: (error) => {
      console.error("Error forwarding message:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось переслать сообщение",
        variant: "destructive",
      });
    },
  });

  const handleTyping = async () => {
    if (!selectedConversation || !currentUserId) return;

    const channel = supabase.channel(`typing:${selectedConversation}`);
    
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: currentUserId,
          typing: true,
        });
      }
    });

    // Сбрасываем предыдущий таймаут
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Устанавливаем новый таймаут для остановки индикации печати
    typingTimeoutRef.current = setTimeout(async () => {
      await channel.track({
        user_id: currentUserId,
        typing: false,
      });
      await channel.unsubscribe();
    }, 3000);
  };

  const getConversationName = (conv: Conversation | undefined) => {
    if (!conv) return "Загрузка...";
    if (conv.type === "group" || conv.type === "public") {
      return conv.name || "Без названия";
    }
    
    // Для личного чата показываем имя собеседника
    const participants = conversationParticipants?.filter(p => p.conversation_id === conv.id) || [];
    const otherParticipantId = participants.find(p => p.user_id !== currentUserId)?.user_id;
    
    if (otherParticipantId) {
      const otherUser = orgUsers?.find(u => u.id === otherParticipantId);
      if (otherUser) {
        return otherUser.full_name || otherUser.email;
      }
    }
    
    return "Личный чат";
  };

  // Фильтрация и сортировка бесед
  const filteredConversations = conversations?.filter(conv => {
    if (!searchQuery) return true;
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    // Сначала закрепленные
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Затем по дате обновления
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Чат</h1>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsNewChatOpen(true)} 
              variant="outline"
              size="icon"
              className="h-10 w-10 relative"
            >
              <MessageCircle className="h-4 w-4" />
              {totalUnread > 0 && (
                <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </div>
              )}
            </Button>
            <Button onClick={() => setIsNewChatOpen(true)} className="gap-2 h-10">
              <MessageCircle className="h-4 w-4" />
              Новая беседа
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
          {/* Список бесед */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <h3 className="font-semibold">Беседы</h3>
              <div className="relative mt-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск бесед..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-1 p-4">
                  {filteredConversations?.map((conv) => {
                    const unreadCount = unreadCounts?.[conv.id] || 0;
                    return (
                      <div
                        key={conv.id}
                        className={`group relative rounded-lg transition-colors ${
                          selectedConversation === conv.id
                            ? "bg-primary/10"
                            : "hover:bg-accent"
                        }`}
                      >
                        <button
                          onClick={() => setSelectedConversation(conv.id)}
                          className="w-full text-left p-3 pr-20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {conv.type === "public" ? "П" : conv.type === "group" ? "Г" : "Л"}
                                </AvatarFallback>
                              </Avatar>
                              {unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                                  {unreadCount > 9 ? "9+" : unreadCount}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {conv.pinned && <Pin className="h-3 w-3 text-primary" />}
                                <div className={`font-medium truncate ${unreadCount > 0 ? "font-bold" : ""} ${selectedConversation === conv.id ? "text-primary" : ""}`}>
                                  {getConversationName(conv)}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(conv.created_at), "dd MMM", { locale: ru })}
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinMutation.mutate({ conversationId: conv.id, pinned: conv.pinned });
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title={conv.pinned ? "Открепить" : "Закрепить"}
                          >
                            <Pin className={`h-4 w-4 ${conv.pinned ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(conv.id);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Удалить беседу"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Область сообщений */}
          <Card className="md:col-span-3 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {getConversationName(conversations?.find(c => c.id === selectedConversation))}
                      </h3>
                      {typingUsers[selectedConversation]?.size > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {Array.from(typingUsers[selectedConversation])
                            .map(userId => {
                              const user = orgUsers?.find(u => u.id === userId);
                              return user?.full_name || user?.email || 'Пользователь';
                            })
                            .join(', ')}{' '}
                          печатает...
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-4 pr-4">
                      {messages?.filter(message => {
                        if (!searchQuery) return true;
                        return message.content.toLowerCase().includes(searchQuery.toLowerCase());
                      }).map((message) => {
                        const isOwnMessage = message.sender_id === currentUserId;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 shadow-sm ${
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground border border-border"
                              }`}
                            >
                              {!isOwnMessage && message.profiles && (
                                <div className="mb-2 pb-2 border-b border-border/50">
                                  <div className="text-sm font-semibold">
                                    {message.profiles.full_name || message.profiles.email}
                                  </div>
                                  {message.profiles.position && (
                                    <div className="text-xs text-muted-foreground">
                                      {message.profiles.position}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              
                              {/* Отображение прикрепленных файлов */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {message.attachments.map((attachment) => (
                                    <a
                                      key={attachment.id}
                                      href={attachment.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 p-2 rounded ${
                                        isOwnMessage ? "bg-primary-foreground/10" : "bg-background"
                                      } hover:opacity-80 transition-opacity`}
                                    >
                                      {attachment.file_type.startsWith('image/') ? (
                                        <img 
                                          src={attachment.file_url} 
                                          alt={attachment.file_name}
                                          className="max-w-full max-h-48 rounded"
                                        />
                                      ) : (
                                        <>
                                          <Download className="h-4 w-4" />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium truncate">{attachment.file_name}</div>
                                            <div className="text-xs opacity-70">
                                              {(attachment.file_size / 1024).toFixed(1)} КБ
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                              
                              <div className={`flex items-center justify-between mt-1 ${isOwnMessage ? "opacity-70" : "text-muted-foreground"}`}>
                                <span className="text-xs">
                                  {format(new Date(message.created_at), "HH:mm", { locale: ru })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setForwardMessageId(message.id)}
                                  className="h-6 w-6 opacity-70 hover:opacity-100"
                                  title="Переслать сообщение"
                                >
                                  <Forward className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <div className="p-4 border-t">
                  {/* Предпросмотр выбранных файлов */}
                  {selectedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                        >
                          <FileIcon className="h-4 w-4" />
                          <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="*/*"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        handleTyping();
                      }}
                      placeholder="Введите сообщение..."
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={!messageText.trim() && selectedFiles.length === 0}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Выберите беседу или создайте новую</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Диалог создания беседы */}
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая беседа</DialogTitle>
              <DialogDescription>
                Создайте личную или групповую беседу
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Тип беседы</Label>
                <Select value={chatType} onValueChange={(v: "direct" | "group") => setChatType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Личная</SelectItem>
                    <SelectItem value="group">Групповая</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {chatType === "group" && (
                <div className="space-y-2">
                  <Label>Название группы</Label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Введите название"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Участники ({selectedUsers.length})</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {orgUsers?.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (chatType === "direct" && selectedUsers.length === 1 && !selectedUsers.includes(user.id)) {
                            return;
                          }
                          setSelectedUsers(prev =>
                            prev.includes(user.id)
                              ? prev.filter(id => id !== user.id)
                              : chatType === "direct" ? [user.id] : [...prev, user.id]
                          );
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedUsers.includes(user.id)
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent"
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {(user.full_name || user.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {user.full_name || user.email}
                          </div>
                          {user.position && (
                            <div className="text-xs text-muted-foreground truncate">
                              {user.position}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewChatOpen(false)}>
                Отменить
              </Button>
              <Button onClick={handleCreateConversation} disabled={createConversationMutation.isPending}>
                {createConversationMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог пересылки сообщения */}
        <Dialog open={!!forwardMessageId} onOpenChange={(open) => !open && setForwardMessageId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Переслать сообщение</DialogTitle>
              <DialogDescription>
                Выберите беседу для пересылки сообщения
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {conversations?.map((conv) => (
                  <Button
                    key={conv.id}
                    variant={forwardToConversation === conv.id ? "default" : "outline"}
                    onClick={() => setForwardToConversation(conv.id)}
                    className="w-full justify-start"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {conv.type === "public" ? "П" : conv.type === "group" ? "Г" : "Л"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{getConversationName(conv)}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setForwardMessageId(null);
                setForwardToConversation(null);
              }}>
                Отменить
              </Button>
              <Button 
                onClick={() => {
                  if (forwardMessageId && forwardToConversation) {
                    forwardMessageMutation.mutate({
                      messageId: forwardMessageId,
                      toConversationId: forwardToConversation
                    });
                  }
                }}
                disabled={!forwardToConversation || forwardMessageMutation.isPending}
              >
                {forwardMessageMutation.isPending ? "Пересылка..." : "Переслать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог подтверждения удаления беседы */}
        <DeleteChatDialog
          open={!!chatToDelete}
          onOpenChange={(open) => !open && setChatToDelete(null)}
          onConfirm={() => {
            if (chatToDelete) {
              deleteConversationMutation.mutate(chatToDelete);
            }
          }}
          conversationName={
            chatToDelete
              ? getConversationName(conversations?.find(c => c.id === chatToDelete))
              : ""
          }
        />
      </div>
    </div>
  );
}
