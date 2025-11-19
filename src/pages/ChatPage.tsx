import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Users, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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

interface Conversation {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

export default function ChatPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [chatType, setChatType] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

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
        .select("id, full_name, email")
        .in("id", senderIds);

      if (profilesError) throw profilesError;

      // Объединяем данные
      const messagesWithProfiles = messagesData.map(msg => ({
        ...msg,
        profiles: profilesData?.find(p => p.id === msg.sender_id) || null
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
        .select("id, full_name, email")
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, queryClient]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("messages")
        .insert([{
          conversation_id: selectedConversation,
          sender_id: user.user?.id,
          content
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation] });
    },
  });

  // Создание беседы
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      // Создаем беседу
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert([{
          organization_id: currentOrgId,
          type: chatType,
          name: chatType === "group" ? groupName : null,
          created_by: user.user?.id
        }])
        .select()
        .single();

      if (convError) throw convError;

      // Добавляем участников
      const participants = [
        { conversation_id: conversation.id, user_id: user.user?.id },
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
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;
    sendMessageMutation.mutate(messageText);
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

  const getConversationName = (conv: Conversation) => {
    if (conv.type === "group" || conv.type === "public") {
      return conv.name || "Без названия";
    }
    return "Личный чат";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Чат</h1>
          <Button onClick={() => setIsNewChatOpen(true)} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Новая беседа
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
          {/* Список бесед */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <h3 className="font-semibold">Беседы</h3>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-1 p-4">
                  {conversations?.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedConversation === conv.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {conv.type === "public" ? "П" : conv.type === "group" ? "Г" : "Л"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{getConversationName(conv)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(conv.created_at), "dd MMM", { locale: ru })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Область сообщений */}
          <Card className="md:col-span-3 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <h3 className="font-semibold">
                    {conversations?.find(c => c.id === selectedConversation)?.name || "Беседа"}
                  </h3>
                </CardHeader>
                <CardContent className="flex-1 p-4 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-4 pr-4">
                      {messages?.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.sender_id === currentUserId
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent"
                            }`}
                          >
                            {message.sender_id !== currentUserId && (
                              <div className="text-xs font-semibold mb-1">
                                {message.profiles?.full_name || message.profiles?.email}
                              </div>
                            )}
                            <div className="text-sm">{message.content}</div>
                            <div className="text-xs opacity-70 mt-1">
                              {format(new Date(message.created_at), "HH:mm", { locale: ru })}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <div className="p-4 border-t">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Введите сообщение..."
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!messageText.trim()}>
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
                    {orgUsers?.filter(u => u.id !== currentUserId).map((user) => (
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
      </div>
    </div>
  );
}
