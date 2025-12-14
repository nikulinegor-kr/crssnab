import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, User, Calendar, Truck, Package } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface RequestDetails {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  priority: string;
  contractor: string | null;
  delivery_date: string | null;
  shipment_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface ClientRequestDetailProps {
  requestId: string;
  onBack: () => void;
  clientId: string;
}

export function ClientRequestDetail({ requestId, onBack, clientId }: ClientRequestDetailProps) {
  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequestDetails();
    fetchComments();

    // Subscribe to new comments
    const channel = supabase
      .channel(`request-comments-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_comments",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, request_date, description, status, priority, contractor, delivery_date, shipment_date, transport_company, waybill_number, created_at")
        .eq("id", requestId)
        .single();

      if (error) throw error;
      setRequest(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from("request_comments")
        .select("id, content, created_at, user_id")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles for comments
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const commentsWithProfiles = commentsData.map(c => ({
          ...c,
          profiles: profilesMap.get(c.user_id) || { full_name: null, email: "Клиент" },
        }));

        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error("Error fetching comments:", error);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("request_comments")
        .insert({
          request_id: requestId,
          user_id: session.user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      toast({
        title: "Отправлено",
        description: "Комментарий добавлен",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Новая": "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "В работе": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      "Отгружено": "bg-purple-500/10 text-purple-500 border-purple-500/20",
      "Доставлено": "bg-green-500/10 text-green-500 border-green-500/20",
      "Выполнено": "bg-green-500/10 text-green-500 border-green-500/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <p className="text-center text-muted-foreground mt-8">Заявка не найдена</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            К списку заявок
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Request Info */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl mb-2">
                  Заявка #{request.request_number}
                </CardTitle>
                <Badge variant="outline" className={getStatusColor(request.status)}>
                  {request.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Описание</h4>
              <p className="text-foreground">{request.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Дата создания</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(request.created_at), "d MMMM yyyy", { locale: ru })}
                  </p>
                </div>
              </div>

              {request.delivery_date && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ожидаемая доставка</p>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(request.delivery_date), "d MMMM yyyy", { locale: ru })}
                    </p>
                  </div>
                </div>
              )}

              {request.contractor && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Поставщик</p>
                    <p className="text-sm font-medium text-foreground">{request.contractor}</p>
                  </div>
                </div>
              )}

              {request.transport_company && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Транспортная компания</p>
                    <p className="text-sm font-medium text-foreground">{request.transport_company}</p>
                    {request.waybill_number && (
                      <p className="text-xs text-muted-foreground">ТТН: {request.waybill_number}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Комментарии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Комментариев пока нет
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 rounded-lg bg-background/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {comment.profiles?.full_name || comment.profiles?.email || "Пользователь"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "d MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="flex gap-2 pt-4 border-t border-border/50">
              <Textarea
                placeholder="Напишите комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] bg-background/50 border-border/50"
              />
              <Button
                onClick={sendComment}
                disabled={sending || !newComment.trim()}
                size="icon"
                className="shrink-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}