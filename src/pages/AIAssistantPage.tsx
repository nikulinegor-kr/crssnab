import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Send, Bot, User, Loader2, Trash2, Sparkles, Plus, MessageSquare, Search, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiChat, type AiMessage } from "@/hooks/useAiChat";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const SUGGESTIONS = [
  "Как приоритизировать заявки при большом потоке?",
  "Помоги составить письмо поставщику о задержке",
  "Какие метрики важны для контроля поставок?",
  "Как оптимизировать процесс закупок?",
];

export default function AIAssistantPage() {
  const { currentOrgId } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    messages, isLoading, conversationId,
    sendMessage, loadConversation, startNewConversation, stopGeneration,
  } = useAiChat();
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations list
  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ["ai-conversations", currentOrgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentOrgId) return [];

      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("organization_id", currentOrgId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Conversation[];
    },
    enabled: !!currentOrgId,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Refetch conversations when conversationId changes (new conv created)
  useEffect(() => {
    if (conversationId) {
      refetchConversations();
    }
  }, [conversationId, refetchConversations]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !currentOrgId || isLoading) return;
    sendMessage(input.trim(), currentOrgId);
    setInput("");
  }, [input, currentOrgId, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    loadConversation(conv.id);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("ai_conversations").delete().eq("id", convId);
    if (error) {
      toast({ title: "Ошибка", description: "Не удалось удалить разговор", variant: "destructive" });
      return;
    }
    if (conversationId === convId) {
      startNewConversation();
    }
    refetchConversations();
  };

  const handleNewChat = () => {
    startNewConversation();
  };

  const filteredConversations = conversations?.filter((c) =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] max-w-6xl mx-auto gap-4">
      {/* Sidebar - conversation list */}
      <div className="w-72 shrink-0 flex flex-col border border-border/40 rounded-xl bg-card overflow-hidden hidden md:flex">
        <div className="p-3 border-b border-border/40 space-y-2">
          <Button onClick={handleNewChat} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Новый разговор
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filteredConversations?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Нет разговоров
              </p>
            )}
            {filteredConversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group flex items-start gap-2",
                  conversationId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{conv.title}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(conv.updated_at), "d MMM, HH:mm", { locale: ru })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  aria-label="Удалить разговор"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/40">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">AI-ассистент</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Claude · помощник менеджера</p>
            </div>
          </div>
          {isLoading && (
            <Button variant="outline" size="sm" onClick={stopGeneration}>
              Остановить
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-medium">Чем могу помочь?</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Я помогу с управлением заявками, закупками, коммуникацией с поставщиками и аналитикой
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="text-left h-auto py-2.5 px-3 text-xs whitespace-normal justify-start"
                    onClick={() => currentOrgId && sendMessage(s, currentOrgId)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 items-start">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border/40">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Задайте вопрос..."
              className="min-h-[44px] max-h-[120px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Отправить сообщение"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
