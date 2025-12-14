import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, Search, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ClientRequestDetail } from "@/components/client-portal/ClientRequestDetail";

interface ClientRequest {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  priority: string;
  contractor: string | null;
  delivery_date: string | null;
  shipment_date: string | null;
  created_at: string;
}

interface ClientInfo {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  organization_id: string;
}

export default function ClientPortal() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkClientAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/client/auth");
        return;
      }

      // Check if user is a client
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, name, email, company_name, organization_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .single();

      if (error || !client) {
        // Not a client, redirect to regular auth
        toast({
          variant: "destructive",
          title: "Доступ запрещён",
          description: "У вас нет доступа к личному кабинету клиента",
        });
        await supabase.auth.signOut();
        navigate("/client/auth");
        return;
      }

      setClientInfo(client);
      fetchRequests(client.id);
    };

    checkClientAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/client/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const fetchRequests = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, request_date, description, status, priority, contractor, delivery_date, shipment_date, created_at")
        .eq("client_id", clientId)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client/auth");
  };

  const filteredRequests = requests.filter(req =>
    req.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const stats = {
    total: requests.length,
    inProgress: requests.filter(r => !["Доставлено", "Выполнено", "Закрыто"].includes(r.status)).length,
    completed: requests.filter(r => ["Доставлено", "Выполнено"].includes(r.status)).length,
  };

  if (selectedRequestId) {
    return (
      <ClientRequestDetail
        requestId={selectedRequestId}
        onBack={() => setSelectedRequestId(null)}
        clientId={clientInfo?.id || ""}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Личный кабинет</h1>
              <p className="text-xs text-muted-foreground">
                {clientInfo?.company_name || clientInfo?.name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Всего заявок</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">В работе</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Выполнено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50"
          />
        </div>

        {/* Requests list */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Мои заявки</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Заявки не найдены</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequestId(request.id)}
                    className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">
                            #{request.request_number}
                          </span>
                          <Badge variant="outline" className={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {request.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Создана: {format(new Date(request.created_at), "d MMM yyyy", { locale: ru })}
                          </span>
                          {request.delivery_date && (
                            <span>
                              Доставка: {format(new Date(request.delivery_date), "d MMM yyyy", { locale: ru })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}