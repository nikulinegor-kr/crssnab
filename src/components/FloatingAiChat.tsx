import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Loader2, User, Sparkles, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiChat, type AiMessage, type PageContext } from "@/hooks/useAiChat";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

const PAGE_NAMES: Record<string, string> = {
  "/requests": "Заявки",
  "/dashboard": "Дашборд",
  "/objects": "Объекты",
  "/suppliers": "Поставщики",
  "/shipments": "Поставки",
  "/warehouse": "Склад",
  "/equipment": "Техника",
  "/nomenclature": "Номенклатура",
  "/calendar": "Календарь",
  "/chat": "Чат команды",
  "/documents": "Документы",
  "/material-statements": "Ведомости материалов",
  
  "/organization/settings": "Настройки",
  "/profile": "Профиль",
};

function getPageContext(pathname: string): PageContext {
  // Match dynamic routes like /requests/123
  const basePath = "/" + pathname.split("/").filter(Boolean)[0];
  const pageName = PAGE_NAMES[pathname] || PAGE_NAMES[basePath] || "Страница CRM";

  // Collect visible data summary from the page
  let summary = "";
  try {
    // Grab stats widgets if present
    const statWidgets = document.querySelectorAll("[data-ai-context]");
    if (statWidgets.length > 0) {
      const parts: string[] = [];
      statWidgets.forEach((el) => {
        const ctx = el.getAttribute("data-ai-context");
        if (ctx) parts.push(ctx);
      });
      if (parts.length) summary += parts.join("; ");
    }

    // Grab table row count
    const tableRows = document.querySelectorAll("table tbody tr");
    if (tableRows.length > 0) {
      summary += (summary ? ". " : "") + `В таблице ${tableRows.length} строк`;
    }

    // Grab page heading
    const h1 = document.querySelector("h1");
    if (h1?.textContent) {
      summary = `Заголовок: ${h1.textContent.trim()}` + (summary ? ". " + summary : "");
    }

    // For request detail pages, grab description
    if (pathname.startsWith("/requests/")) {
      const descEl = document.querySelector("[data-ai-context='request-description']")
        || document.querySelector(".whitespace-pre-wrap");
      if (descEl?.textContent) {
        summary += (summary ? ". " : "") + `Описание заявки: ${descEl.textContent.trim().slice(0, 200)}`;
      }
    }
  } catch {
    // DOM access errors are non-critical
  }

  return { pageName, url: pathname, summary: summary || undefined };
}

const QUICK_PROMPTS = [
  "Помоги составить письмо поставщику",
  "Как приоритизировать заявки?",
  "Подскажи по оптимизации закупок",
];

export function FloatingAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const { currentOrgId } = useCurrentOrganization();
  const { messages, isLoading, sendMessage, startNewConversation } = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSendWithContext = useCallback((text: string) => {
    if (!text.trim() || !currentOrgId || isLoading) return;
    const ctx = getPageContext(location.pathname);
    sendMessage(text.trim(), currentOrgId, ctx);
  }, [currentOrgId, isLoading, sendMessage, location.pathname]);

  const handleSend = () => {
    handleSendWithContext(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        aria-label="Открыть AI-ассистент"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl transition-all duration-200",
        isExpanded
          ? "bottom-4 right-4 w-[560px] h-[700px]"
          : "bottom-6 right-6 w-[380px] h-[520px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">AI-ассистент</p>
            <p className="text-[11px] text-muted-foreground">Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startNewConversation}
              aria-label="Новый разговор"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Уменьшить" : "Увеличить"}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
            aria-label="Закрыть чат"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Задайте вопрос по CRM
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {QUICK_PROMPTS.map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 justify-start whitespace-normal text-left"
                  onClick={() => handleSendWithContext(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2 items-start">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border/40">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Задайте вопрос..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm border-0 bg-muted/50 focus-visible:ring-1"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Отправить"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "rounded-xl px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
