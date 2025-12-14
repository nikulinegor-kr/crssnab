import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, GripVertical, ChevronLeft, ChevronRight, X, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [applicantFilter, setApplicantFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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

  // Get unique values for filters
  const uniquePriorities = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.map(r => r.priority).filter(Boolean))];
  }, [requests]);

  const uniqueApplicants = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.map(r => r.applicant).filter(Boolean))] as string[];
  }, [requests]);

  const uniqueContractors = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.map(r => r.contractor).filter(Boolean))] as string[];
  }, [requests]);

  const hasActiveFilters = priorityFilter !== "all" || applicantFilter !== "all" || contractorFilter !== "all";

  const clearFilters = () => {
    setPriorityFilter("all");
    setApplicantFilter("all");
    setContractorFilter("all");
  };

  // Filter requests by search and filters
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    return requests.filter(r => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          r.description.toLowerCase().includes(query) ||
          r.request_number.toLowerCase().includes(query) ||
          r.applicant?.toLowerCase().includes(query) ||
          r.contractor?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Priority filter
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      
      // Applicant filter
      if (applicantFilter !== "all" && r.applicant !== applicantFilter) return false;
      
      // Contractor filter
      if (contractorFilter !== "all" && r.contractor !== contractorFilter) return false;
      
      return true;
    });
  }, [requests, searchQuery, priorityFilter, applicantFilter, contractorFilter]);

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

  const toggleColumnCollapse = (statusName: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(statusName)) {
        next.delete(statusName);
      } else {
        next.add(statusName);
      }
      return next;
    });
  };

  if (loadingStatuses || loadingRequests) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allStatuses = [
    ...(statuses || []),
    ...(requestsByStatus["Другое"]?.length ? [{ id: "other", name: "Другое", color: "#6b7280", order: 999 }] : [])
  ];

  // Calculate column width based on number of statuses
  const columnCount = allStatuses.length;
  const getColumnWidth = () => {
    if (isMobile) return "w-[85vw]";
    if (columnCount <= 3) return "flex-1 min-w-[200px]";
    if (columnCount <= 5) return "w-[220px] shrink-0";
    return "w-[180px] shrink-0";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 py-2 px-4 sm:px-6 shrink-0 bg-background border-b border-border/30">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Канбан-доска</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Перетаскивайте заявки между колонками</p>
          </div>
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Фильтры:</span>
          </div>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              {uniquePriorities.map(priority => (
                <SelectItem key={priority} value={priority}>{priority}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={applicantFilter} onValueChange={setApplicantFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] max-w-[150px] text-xs">
              <SelectValue placeholder="Заявитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все заявители</SelectItem>
              {uniqueApplicants.map(applicant => (
                <SelectItem key={applicant} value={applicant}>
                  <span className="truncate">{applicant}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={contractorFilter} onValueChange={setContractorFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] max-w-[150px] text-xs">
              <SelectValue placeholder="Контрагент" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все контрагенты</SelectItem>
              {uniqueContractors.map(contractor => (
                <SelectItem key={contractor} value={contractor}>
                  <span className="truncate">{contractor}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Сбросить
            </Button>
          )}
          
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {filteredRequests.length} заявок
          </Badge>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-3">
        <div className={cn(
          "flex gap-2 h-full",
          isMobile ? "overflow-x-auto snap-x snap-mandatory" : columnCount <= 3 ? "" : "overflow-x-auto"
        )}>
          {allStatuses.map((status) => {
            const isOver = dragOverStatus === status.name;
            const count = requestsByStatus[status.name]?.length || 0;
            const isCollapsed = collapsedColumns.has(status.name);
            
            return (
              <div
                key={status.id}
                className={cn(
                  "rounded-lg border border-border/50 bg-muted/20 transition-all flex flex-col",
                  isCollapsed ? "w-10 shrink-0" : getColumnWidth(),
                  isMobile && !isCollapsed && "snap-center",
                  isOver && "border-primary/50 bg-primary/5"
                )}
                onDragOver={(e) => handleDragOver(e, status.name)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status.name)}
              >
                {/* Column Header */}
                <div className={cn(
                  "border-b border-border/30 bg-background/60 backdrop-blur-sm rounded-t-lg shrink-0",
                  isCollapsed ? "px-1 py-2" : "px-2 py-2"
                )}>
                  <div className={cn(
                    "flex items-center gap-1",
                    isCollapsed ? "flex-col" : "justify-between"
                  )}>
                    <button
                      onClick={() => toggleColumnCollapse(status.name)}
                      className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
                      title={isCollapsed ? "Развернуть" : "Свернуть"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    
                    {isCollapsed ? (
                      <>
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="font-medium text-[10px] writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
                          {status.name}
                        </span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">
                          {count}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="font-medium text-xs truncate">
                            {status.name}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                          {count}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {/* Cards Container - only show when not collapsed */}
                {!isCollapsed && (
                  <div className="p-1.5 space-y-1.5 flex-1 overflow-y-auto min-h-0">
                    {requestsByStatus[status.name]?.map((request) => (
                      <div
                        key={request.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, request.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/requests/${request.id}`)}
                        className={cn(
                          "p-2 rounded bg-background border border-border/40 cursor-pointer",
                          "hover:border-primary/40 hover:shadow-sm transition-all",
                          "active:scale-[0.98]",
                          draggingRequest === request.id && "opacity-50 scale-95"
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-[11px] font-medium line-clamp-2 leading-tight">
                              {request.description}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[9px] text-muted-foreground font-mono">
                                #{request.request_number.slice(-6)}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[9px] px-1 py-0 h-3.5", getPriorityColor(request.priority))}
                              >
                                {request.priority}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                              <span>{format(new Date(request.request_date), "dd.MM", { locale: ru })}</span>
                              {request.applicant && (
                                <span className="truncate max-w-[60px]" title={request.applicant}>
                                  {request.applicant}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {count === 0 && (
                      <div className="text-center py-4 text-[10px] text-muted-foreground">
                        Нет заявок
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
