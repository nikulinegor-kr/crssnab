import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Request {
  id: string;
  request_number: string;
  description: string;
  status: string;
  priority: string;
  applicant: string | null;
  contractor: string | null;
  request_date: string;
}

interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
}

export default function KanbanBoard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingRequest, setDraggingRequest] = useState<string | null>(null);
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch statuses
  const { data: statuses, isLoading: loadingStatuses } = useQuery({
    queryKey: ["request-statuses", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("request_statuses")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("order", { ascending: true });
      if (error) throw error;
      return data as Status[];
    },
    enabled: !!currentOrgId,
  });

  // Fetch requests
  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["requests-kanban", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, priority, applicant, contractor, request_date")
        .eq("organization_id", currentOrgId)
        .eq("archived", false)
        .order("request_date", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
    enabled: !!currentOrgId,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, newStatus }: { requestId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("requests")
        .update({ status: newStatus })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests-kanban", currentOrgId] });
      toast({ title: "Статус обновлён" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    },
  });

  // Filter requests by search
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (!searchQuery.trim()) return requests;
    
    const query = searchQuery.toLowerCase();
    return requests.filter(r =>
      r.description.toLowerCase().includes(query) ||
      r.request_number.toLowerCase().includes(query) ||
      r.applicant?.toLowerCase().includes(query) ||
      r.contractor?.toLowerCase().includes(query)
    );
  }, [requests, searchQuery]);

  // Group requests by status
  const requestsByStatus = useMemo(() => {
    const grouped: Record<string, Request[]> = {};
    statuses?.forEach(status => {
      grouped[status.name] = filteredRequests.filter(r => r.status === status.name);
    });
    // Handle requests with unknown statuses
    const knownStatuses = new Set(statuses?.map(s => s.name) || []);
    const unknownRequests = filteredRequests.filter(r => !knownStatuses.has(r.status));
    if (unknownRequests.length > 0) {
      grouped["Другое"] = unknownRequests;
    }
    return grouped;
  }, [filteredRequests, statuses]);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      "Аварийно": "bg-red-500/20 text-red-500 border-red-500/30",
      "Срочно": "bg-orange-500/20 text-orange-500 border-orange-500/30",
      "Высокий": "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      "Средний": "bg-blue-500/20 text-blue-500 border-blue-500/30",
      "Низкий": "bg-green-500/20 text-green-500 border-green-500/30",
      "Планово": "bg-slate-500/20 text-slate-500 border-slate-500/30",
    };
    return colors[priority] || "bg-muted text-muted-foreground";
  };

  const handleDragStart = (e: React.DragEvent, requestId: string) => {
    setDraggingRequest(requestId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, statusName: string) => {
    e.preventDefault();
    if (draggingRequest) {
      const request = requests?.find(r => r.id === draggingRequest);
      if (request && request.status !== statusName) {
        updateStatusMutation.mutate({
          requestId: draggingRequest,
          newStatus: statusName,
        });
      }
    }
    setDraggingRequest(null);
  };

  const handleDragEnd = () => {
    setDraggingRequest(null);
  };

  if (loadingStatuses || loadingRequests) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allStatuses = [
    ...(statuses || []),
    ...(requestsByStatus["Другое"]?.length ? [{ id: "other", name: "Другое", color: "#6b7280", order: 999 }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Канбан-доска</h1>
          <p className="text-muted-foreground">Визуализация заявок по статусам</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск заявок..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {allStatuses.map((status) => (
          <div
            key={status.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status.name)}
          >
            <Card className="glassmorphism border-border/40 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    {status.name}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {requestsByStatus[status.name]?.length || 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3 pr-4">
                    {requestsByStatus[status.name]?.map((request) => (
                      <div
                        key={request.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, request.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/requests/${request.id}`)}
                        className={`p-3 rounded-lg bg-background/80 border border-border/40 cursor-pointer
                          hover:border-primary/40 hover:shadow-md transition-all
                          ${draggingRequest === request.id ? "opacity-50 scale-95" : ""}
                        `}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {request.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {request.request_number}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getPriorityColor(request.priority)}`}
                              >
                                {request.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(request.request_date), "dd.MM.yy", { locale: ru })}
                              </span>
                            </div>
                            {(request.applicant || request.contractor) && (
                              <div className="mt-2 text-xs text-muted-foreground truncate">
                                {request.applicant && <span>👤 {request.applicant}</span>}
                                {request.contractor && <span className="ml-2">🏢 {request.contractor}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!requestsByStatus[status.name] || requestsByStatus[status.name].length === 0) && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        Нет заявок
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
