import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Search, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
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
      "Аварийно": "bg-red-500/20 text-red-400 border-red-500/30",
      "Срочно": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "Высокий": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "Средний": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "Низкий": "bg-green-500/20 text-green-400 border-green-500/30",
      "Планово": "bg-slate-500/20 text-slate-400 border-slate-500/30",
    };
    return colors[priority] || "bg-muted text-muted-foreground";
  };

  const handleDragStart = (e: React.DragEvent, requestId: string) => {
    setDraggingRequest(requestId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, statusName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(statusName);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
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
    setDragOverStatus(null);
  };

  const handleDragEnd = () => {
    setDraggingRequest(null);
    setDragOverStatus(null);
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
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Канбан-доска</h1>
          <p className="text-sm text-muted-foreground">Перетаскивайте заявки между колонками</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex gap-3 pb-4 pr-4 min-w-max h-[calc(100vh-200px)]">
          {allStatuses.map((status) => {
            const isOver = dragOverStatus === status.name;
            const count = requestsByStatus[status.name]?.length || 0;
            
            return (
              <div
                key={status.id}
                className={cn(
                  "w-64 lg:w-72 shrink-0 rounded-lg border border-border/50 bg-muted/30 transition-all flex flex-col h-full",
                  isOver && "border-primary/50 bg-primary/5"
                )}
                onDragOver={(e) => handleDragOver(e, status.name)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status.name)}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-border/30 sticky top-0 bg-background/80 backdrop-blur-sm rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="font-medium text-sm truncate max-w-[140px]">
                        {status.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
                      {count}
                    </Badge>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {requestsByStatus[status.name]?.map((request) => (
                    <div
                      key={request.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, request.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/requests/${request.id}`)}
                      className={cn(
                        "p-2.5 rounded-md bg-background border border-border/40 cursor-pointer",
                        "hover:border-primary/40 hover:shadow-sm transition-all",
                        "active:scale-[0.98]",
                        draggingRequest === request.id && "opacity-50 scale-95 rotate-1"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5 cursor-grab" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-xs font-medium line-clamp-2 leading-snug">
                            {request.description}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{request.request_number}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1 py-0 h-4", getPriorityColor(request.priority))}
                            >
                              {request.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{format(new Date(request.request_date), "dd.MM.yy", { locale: ru })}</span>
                            {request.applicant && (
                              <span className="truncate max-w-[80px]" title={request.applicant}>
                                {request.applicant}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {count === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Нет заявок
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
