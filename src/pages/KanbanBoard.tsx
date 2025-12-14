import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, GripVertical, ChevronLeft, ChevronRight, X, Filter, Plus, AlertTriangle, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { useViewSettings } from "@/hooks/useViewSettings";

interface Request {
  id: string;
  request_number: string;
  description: string;
  status: string;
  priority: string;
  applicant: string | null;
  contractor: string | null;
  request_date: string;
  delivery_date: string | null;
  executor: string | null;
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
  const [executorFilter, setExecutorFilter] = useState<string>("all");
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { settings } = useViewSettings();

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
        .select("id, request_number, description, status, priority, applicant, contractor, request_date, delivery_date, executor")
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

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ requestIds, newStatus }: { requestIds: string[]; newStatus: string }) => {
      const { error } = await supabase
        .from("requests")
        .update({ status: newStatus })
        .in("id", requestIds);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests-kanban", currentOrgId] });
      toast({ title: `Обновлено ${variables.requestIds.length} заявок` });
      setSelectedRequests(new Set());
      setIsSelectionMode(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статусы",
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

  const uniqueExecutors = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.map(r => r.executor).filter(Boolean))] as string[];
  }, [requests]);

  const hasActiveFilters = priorityFilter !== "all" || applicantFilter !== "all" || contractorFilter !== "all" || executorFilter !== "all";

  const clearFilters = () => {
    setPriorityFilter("all");
    setApplicantFilter("all");
    setContractorFilter("all");
    setExecutorFilter("all");
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
      
      // Executor filter
      if (executorFilter !== "all" && r.executor !== executorFilter) return false;
      
      return true;
    });
  }, [requests, searchQuery, priorityFilter, applicantFilter, contractorFilter, executorFilter]);

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

  // Check if request is overdue (completed requests are never overdue)
  const getDeadlineStatus = (deliveryDate: string | null, status: string) => {
    if (!deliveryDate) return null;
    // Completed requests are not overdue
    if (status === "Доставлено") return null;
    
    const date = new Date(deliveryDate);
    if (isPast(date) && !isToday(date)) {
      const daysOverdue = differenceInDays(new Date(), date);
      return { isOverdue: true, daysOverdue, label: `Просрочено на ${daysOverdue} дн.` };
    }
    if (isToday(date)) {
      return { isOverdue: false, daysOverdue: 0, label: "Сегодня" };
    }
    const daysLeft = differenceInDays(date, new Date());
    if (daysLeft <= 3) {
      return { isOverdue: false, daysOverdue: 0, label: `Осталось ${daysLeft} дн.` };
    }
    return null;
  };

  const toggleRequestSelection = (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRequests(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const handleBulkStatusChange = (newStatus: string) => {
    if (selectedRequests.size === 0) return;
    bulkUpdateStatusMutation.mutate({
      requestIds: Array.from(selectedRequests),
      newStatus,
    });
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev);
    if (isSelectionMode) {
      setSelectedRequests(new Set());
    }
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
    if (columnCount <= 3) return "flex-1 min-w-[280px]";
    if (columnCount <= 5) return "w-[280px] shrink-0";
    return "w-[240px] shrink-0";
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
          
          <Select value={executorFilter} onValueChange={setExecutorFilter}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] max-w-[150px] text-xs">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все исполнители</SelectItem>
              {uniqueExecutors.map(executor => (
                <SelectItem key={executor} value={executor}>
                  <span className="truncate">{executor}</span>
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
          
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant={isSelectionMode ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleSelectionMode}
              className="h-7 px-2 text-xs"
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              {isSelectionMode ? `Выбрано: ${selectedRequests.size}` : "Выбрать"}
            </Button>
            
            <Badge variant="secondary" className="text-[10px]">
              {filteredRequests.length} заявок
            </Badge>
          </div>
        </div>
        
        {/* Bulk Actions Bar */}
        {isSelectionMode && selectedRequests.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-xs text-muted-foreground">Изменить статус:</span>
            {statuses?.map(status => (
              <Button
                key={status.id}
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange(status.name)}
                className="h-6 px-2 text-xs"
                disabled={bulkUpdateStatusMutation.isPending}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRequests(new Set());
                setIsSelectionMode(false);
              }}
              className="h-6 px-2 text-xs ml-auto"
            >
              Отмена
            </Button>
          </div>
        )}
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
                  isCollapsed ? "px-1 py-2" : "px-3 py-2.5"
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
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {isCollapsed ? (
                      <>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="font-medium text-xs writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
                          {status.name}
                        </span>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
                          {count}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="font-semibold text-sm truncate">
                            {status.name}
                          </span>
                          <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
                            {count}
                          </Badge>
                        </div>
                        {status.id !== "other" && (
                          <CreateRequestDialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 hover:bg-primary/10"
                              title="Создать заявку"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </CreateRequestDialog>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Cards Container - only show when not collapsed */}
                {!isCollapsed && (
                  <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                    {requestsByStatus[status.name]?.map((request) => {
                      const deadlineStatus = getDeadlineStatus(request.delivery_date, request.status);
                      const isSelected = selectedRequests.has(request.id);
                      
                      return (
                        <div
                          key={request.id}
                          draggable={!isSelectionMode}
                          onDragStart={(e) => !isSelectionMode && handleDragStart(e, request.id)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => isSelectionMode ? toggleRequestSelection(request.id, e) : navigate(`/requests/${request.id}`)}
                          className={cn(
                            "p-3 rounded-lg bg-background border cursor-pointer",
                            "hover:shadow-md transition-all",
                            "active:scale-[0.98]",
                            draggingRequest === request.id && "opacity-50 scale-95",
                            deadlineStatus?.isOverdue && "border-destructive/50 bg-destructive/5",
                            !deadlineStatus?.isOverdue && "border-border/40 hover:border-primary/40",
                            isSelected && "ring-2 ring-primary border-primary"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {isSelectionMode ? (
                              <Checkbox 
                                checked={isSelected} 
                                className="mt-0.5 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab" />
                            )}
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="text-sm font-medium line-clamp-2 leading-snug">
                                {request.description}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {settings.kanban.showRequestNumber && (
                                  <span className="text-xs text-muted-foreground font-mono">
                                    #{request.request_number.slice(-6)}
                                  </span>
                                )}
                                {settings.kanban.showPriority && (
                                  <Badge
                                    variant="outline"
                                    className={cn("text-xs px-2 py-0.5 h-5", getPriorityColor(request.priority))}
                                  >
                                    {request.priority}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Deadline indicator */}
                              {settings.kanban.showDeadline && deadlineStatus && (
                                <div className={cn(
                                  "flex items-center gap-1 text-xs",
                                  deadlineStatus.isOverdue ? "text-destructive" : "text-warning"
                                )}>
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{deadlineStatus.label}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{format(new Date(request.request_date), "dd.MM.yy", { locale: ru })}</span>
                                {settings.kanban.showExecutor && request.executor && (
                                  <span className="truncate max-w-[100px] text-primary/70" title={request.executor}>
                                    {request.executor}
                                  </span>
                                )}
                              </div>
                              
                              {/* Additional fields based on settings */}
                              {(settings.kanban.showApplicant && request.applicant) || (settings.kanban.showContractor && request.contractor) ? (
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                  {settings.kanban.showApplicant && request.applicant && (
                                    <span className="truncate" title={request.applicant}>
                                      Заявитель: {request.applicant}
                                    </span>
                                  )}
                                  {settings.kanban.showContractor && request.contractor && (
                                    <span className="truncate" title={request.contractor}>
                                      Подрядчик: {request.contractor}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {count === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
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
