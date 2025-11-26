import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Send, AlertCircle, Trash2, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import { Request } from "@/hooks/useRequests";
import { ExcelExportButton } from "@/components/dashboard/ExcelExportButton";
import { LabelExportButton } from "@/components/dashboard/LabelExportButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";

const Requests = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const { data: requests, isLoading } = useRequests(activeTab === "archived");
  const { canCreate } = useUserRole();
  const { currentOrgId } = useCurrentOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [applicantFilter, setApplicantFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hideDelivered, setHideDelivered] = useState(true);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isTelegramConfigured, setIsTelegramConfigured] = useState<boolean | null>(null);
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [years, setYears] = useState<string[]>(["2019", "2020", "2021", "2022", "2023", "2024", "2025"]);
  const [newYear, setNewYear] = useState("");
  const [requestToDelete, setRequestToDelete] = useState<Request | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  // Check Telegram configuration
  useEffect(() => {
    const checkTelegramConfig = async () => {
      if (!currentOrgId) return;
      
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("telegram_bot_token, telegram_chat_id")
          .eq("id", currentOrgId)
          .single();

        if (error) throw error;
        
        const isConfigured = !!(data?.telegram_bot_token && data?.telegram_chat_id);
        setIsTelegramConfigured(isConfigured);
      } catch (error) {
        console.error("Error checking Telegram config:", error);
        setIsTelegramConfigured(false);
      }
    };

    checkTelegramConfig();
  }, [currentOrgId]);

  // Apply filters from URL params on mount
  useEffect(() => {
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const isNew = searchParams.get("new");
    
    if (status) {
      // Handle negative filter (exclude status)
      if (status.startsWith("!")) {
        const excludeStatus = status.substring(1);
        if (excludeStatus === "Доставлено") {
          setHideDelivered(true);
        }
      } else {
        setStatusFilter([status]);
      }
    }
    if (priority) {
      setPriorityFilter(priority);
    }
    if (isNew === "true") {
      const today = new Date().toISOString().split("T")[0];
      setYearFilter(new Date().getFullYear().toString());
    }
  }, [searchParams]);

  const handleRowClick = (request: Request, e: React.MouseEvent) => {
    // Don't open dialog if clicking on checkbox
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigate(`/requests/${request.id}`);
  };

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const toggleAllRequests = () => {
    if (selectedRequestIds.size === filteredRequests?.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filteredRequests?.map(r => r.id) || []));
    }
  };

  const handleSendToTelegram = async () => {
    if (selectedRequestIds.size === 0) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы одну заявку для отправки",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Verify user session before sending
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session:", !!session);
      
      if (!session) {
        toast({
          title: "Ошибка авторизации",
          description: "Сессия истекла. Пожалуйста, войдите снова.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let errorMessages: string[] = [];

      for (const requestId of Array.from(selectedRequestIds)) {
        try {
          console.log("Sending request to Telegram:", requestId);
          
          // Get current session token
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Токен авторизации недоступен");
          }

          const { data, error } = await supabase.functions.invoke('notify-telegram', {
            body: { requestId, mode: 'send' },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          console.log("Response:", { data, error });

          if (error) {
            console.error(`Error sending request ${requestId}:`, error);
            errorMessages.push(error.message || 'Неизвестная ошибка');
            errorCount++;
          } else if (data?.error) {
            console.error(`Error sending request ${requestId}:`, data.error);
            errorMessages.push(data.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err: any) {
          console.error(`Error sending request ${requestId}:`, err);
          errorMessages.push(err.message || 'Неизвестная ошибка');
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Успешно отправлено",
          description: `Отправлено заявок: ${successCount}${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`,
        });
        setSelectedRequestIds(new Set());
      } else {
        const uniqueErrors = [...new Set(errorMessages)];
        const errorDetail = uniqueErrors.length > 0 ? uniqueErrors[0] : "Проверьте настройки Telegram";
        
        // Check if it's a Telegram configuration error
        const isTelegramConfigError = errorDetail.includes("Telegram не настроен");
        
        toast({
          title: "Ошибка отправки",
          description: errorDetail,
          variant: "destructive",
          action: isTelegramConfigError ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings?tab=integrations")}
            >
              Настроить Telegram
            </Button>
          ) : undefined,
        });
      }
    } catch (error: any) {
      console.error('Error sending to Telegram:', error);
      toast({
        title: "Ошибка отправки",
        description: error.message || "Не удалось отправить заявки в Telegram. Проверьте настройки Telegram в разделе Настройки → Интеграции",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteClick = (request: Request, e: React.MouseEvent) => {
    e.stopPropagation();
    setRequestToDelete(request);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!requestToDelete || !currentOrgId) return;

    try {
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Пользователь не авторизован");
      }

      // Получаем информацию о профиле пользователя
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const userName = profile?.full_name || profile?.email || "Неизвестный пользователь";

      // Логируем архивацию в audit_logs
      await supabase.rpc("log_audit_event", {
        _organization_id: currentOrgId,
        _action: "archive",
        _entity_type: "request",
        _entity_id: requestToDelete.id,
        _old_values: {
          request_number: requestToDelete.request_number,
          description: requestToDelete.description,
          status: requestToDelete.status,
          archived_by: userName,
          archive_reason: "Перемещена в архив"
        }
      });

      // Архивируем заявку вместо удаления
      const { error } = await supabase
        .from("requests")
        .update({ archived: true })
        .eq("id", requestToDelete.id);

      if (error) throw error;

      toast({
        title: "Заявка перемещена в архив",
        description: `Заявка "${requestToDelete.description}" перемещена в архив.`,
      });

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowDeleteDialog(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error("Error archiving request:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось переместить заявку в архив",
        variant: "destructive",
      });
    }
  };

  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      request.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(request.status);
    const matchesPriority =
      priorityFilter === "all" || request.priority === priorityFilter;
    const matchesYear =
      yearFilter === "all" ||
      request.request_date.startsWith(yearFilter);
    const matchesApplicant =
      applicantFilter === "all" || request.applicant === applicantFilter;
    const matchesDelivered =
      activeTab === "archived"
        ? true
        : (!hideDelivered || request.status !== "Доставлено");
    return matchesSearch && matchesStatus && matchesPriority && matchesYear && matchesApplicant && matchesDelivered;
  });

  // Получаем уникальных заявителей
  const uniqueApplicants = Array.from(
    new Set(requests?.map(r => r.applicant).filter(Boolean))
  ).sort() as string[];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Доставлено":
      case "Доставлено в ТК":
      case "Выполнено":
        return "#10b981";
      case "Новая заявка":
        return "#3b82f6";
      case "На согласовании":
      case "КП":
        return "#a855f7";
      case "Счёт":
        return "#f97316";
      case "В работе":
      case "В пути":
        return "#eab308";
      default:
        return "#6b7280";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Аварийно":
        return "#ef4444";
      case "Приоритетно":
        return "#f97316";
      case "Планово":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const statuses = [
    "Новая заявка",
    "На согласовании",
    "КП",
    "Счёт",
    "В работе",
    "В пути",
    "Доставлено в ТК",
    "Доставлено",
    "Выполнено",
  ];
  const priorities = ["Аварийно", "Планово", "Приоритетно"];

  const selectAllStatuses = () => {
    if (statusFilter.length === statuses.length) {
      setStatusFilter([]);
    } else {
      setStatusFilter([...statuses]);
    }
  };

  const addYear = () => {
    const trimmedYear = newYear.trim();
    if (trimmedYear && !years.includes(trimmedYear)) {
      setYears([...years, trimmedYear].sort());
      setNewYear("");
      toast({
        title: "Год добавлен",
        description: `Год ${trimmedYear} добавлен в список`,
      });
    } else if (years.includes(trimmedYear)) {
      toast({
        title: "Год уже существует",
        description: `Год ${trimmedYear} уже есть в списке`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full overflow-hidden p-2 sm:p-3 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {isTelegramConfigured === false && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Telegram не настроен. Настройте его для отправки уведомлений о заявках.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="ml-4"
            >
              Настроить
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archived")} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Все заявки</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {filteredRequests?.length || 0} заявок найдено
              {selectedRequestIds.size > 0 && (
                <span className="ml-2 text-primary font-medium">
                  • Выбрано: {selectedRequestIds.size}
                </span>
              )}
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="active">Активные</TabsTrigger>
            <TabsTrigger value="archived">Архив</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value={activeTab} className="space-y-4 mt-0">
        
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {requests && requests.length > 0 && (
            <>
              <ExcelExportButton 
                requests={requests} 
                filteredRequests={filteredRequests}
              />
              <LabelExportButton 
                selectedRequests={Array.from(selectedRequestIds).map(id => 
                  requests.find(r => r.id === id)!
                ).filter(Boolean)}
              />
            </>
          )}
          {selectedRequestIds.size > 0 && (
            <Button
              onClick={handleSendToTelegram}
              disabled={isSending}
              className="gap-2 w-full sm:w-auto"
              size="sm"
            >
              <Send className="h-4 w-4" />
              <span>Отправить в Telegram</span>
            </Button>
          )}
          {canCreate && (
            <CreateRequestDialog>
              <Button className="gap-2 w-full sm:w-auto" size="sm">
                <Plus className="h-4 w-4" />
                <span>Создать заявку</span>
              </Button>
            </CreateRequestDialog>
          )}
        </div>

      <Card className="p-3 sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between text-sm">
                  {statusFilter.length === 0 
                    ? "Статус" 
                    : `Статус (${statusFilter.length})`}
                  {statusFilter.length > 0 && (
                    <X 
                      className="h-4 w-4 ml-2" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter([]);
                      }}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-4 bg-background z-50" align="start">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Выберите статусы</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllStatuses}
                    className="w-full"
                  >
                    {statusFilter.length === statuses.length ? "Снять всё" : "Выбрать всё"}
                  </Button>
                  <div className="space-y-2">
                    {statuses.map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={statusFilter.includes(status)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setStatusFilter([...statusFilter, status]);
                            } else {
                              setStatusFilter(statusFilter.filter(s => s !== status));
                            }
                          }}
                        />
                        <label
                          htmlFor={`status-${status}`}
                          className="text-sm cursor-pointer"
                        >
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Приоритет" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">Все приоритеты</SelectItem>
                {priorities.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={applicantFilter} onValueChange={setApplicantFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Заявитель" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="all">Все заявители</SelectItem>
                {uniqueApplicants.map((applicant) => (
                  <SelectItem key={applicant} value={applicant}>
                    {applicant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="text-sm">
                  {yearFilter === "all" ? "Год" : yearFilter}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-4 bg-background z-50" align="start">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Выберите год</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Год" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      <SelectItem value="all">Все годы</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-sm font-semibold">Добавить новый год</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="2026"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addYear();
                          }
                        }}
                        className="text-sm"
                      />
                      <Button onClick={addYear} size="sm">
                        Добавить
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-md">
              <Checkbox
                id="hideDelivered"
                checked={hideDelivered}
                onCheckedChange={(checked) => setHideDelivered(checked as boolean)}
              />
              <Label htmlFor="hideDelivered" className="cursor-pointer text-xs sm:text-sm whitespace-nowrap">
                Скрыть доставленные
              </Label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 sm:h-12 w-full" />
            ))}
          </div>
        ) : filteredRequests && filteredRequests.length > 0 ? (
          <>
            {/* Mobile and Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredRequests.map((request) => (
                <Card 
                  key={request.id} 
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      handleRowClick(request, e);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedRequestIds.has(request.id)}
                      onCheckedChange={() => toggleRequestSelection(request.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-7 w-7 lg:h-4 lg:w-4"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">
                            {format(new Date(request.request_date), "dd.MM.yy")}
                          </div>
                          <div className="font-medium text-sm line-clamp-2">
                            {request.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ 
                            borderColor: getPriorityColor(request.priority || "Планово"),
                            color: getPriorityColor(request.priority || "Планово")
                          }}
                        >
                          {request.priority || "Планово"}
                        </Badge>
                        <Badge 
                          className="text-xs"
                          style={{ 
                            backgroundColor: getStatusColor(request.status),
                            color: "white"
                          }}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      
                      {(request.contractor || request.applicant || request.executor) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {request.contractor && (
                            <div className="truncate">Контрагент: {request.contractor}</div>
                          )}
                          {request.applicant && (
                            <div className="truncate">Заявитель: {request.applicant}</div>
                          )}
                          {request.executor && (
                            <div className="truncate">Исполнитель: {request.executor}</div>
                          )}
                        </div>
                      )}
                      
                      {request.comments && (
                        <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded">
                          {request.comments}
                        </div>
                      )}
                      
                      <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                          onClick={(e) => handleDeleteClick(request, e)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Исключить заявку
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-md border overflow-x-auto">
              <Table className="w-full table-auto border-collapse">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/50 border-b">
                    <TableHead className="w-10 text-center border-r p-1">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedRequestIds.size === filteredRequests?.length && filteredRequests.length > 0}
                          onCheckedChange={toggleAllRequests}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Дата</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Заявка</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Приоритет</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Статус</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">Наличие</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Контрагент</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">Счёт</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Оплата</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">ДатаО</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">ДатаД</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">ТК</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">№ ТТН</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs">Заявитель</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">Комментарий</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">Исполнитель</TableHead>
                    <TableHead className="text-center border-r p-1 text-xs hidden xl:table-cell">Счёт/КП</TableHead>
                    <TableHead className="text-center p-1 text-xs">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow 
                      key={request.id} 
                      className="hover:bg-muted/30 cursor-pointer border-b"
                      onClick={(e) => handleRowClick(request, e)}
                    >
                      <TableCell className="text-xs text-center border-r p-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedRequestIds.has(request.id)}
                            onCheckedChange={() => toggleRequestSelection(request.id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1">
                        <div className="line-clamp-2">
                          {format(new Date(request.request_date), "dd.MM.yy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 max-w-[120px]">
                        <div className="line-clamp-2">
                          {request.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1">
                        <Badge 
                          variant="outline" 
                          className="whitespace-nowrap text-[10px] px-1 py-0"
                          style={{ 
                            borderColor: getPriorityColor(request.priority || "Планово"),
                            color: getPriorityColor(request.priority || "Планово")
                          }}
                        >
                          {request.priority || "Планово"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1">
                        <Badge 
                          className="whitespace-nowrap text-[10px] px-1 py-0"
                          style={{ 
                            backgroundColor: getStatusColor(request.status),
                            color: "white"
                          }}
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.availability_delivery_time || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 max-w-[100px]">
                        <div className="line-clamp-2">
                          {request.contractor || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.invoice_number || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1">
                        <div className="line-clamp-2">
                          {request.payment_percentage !== null && request.payment_percentage !== undefined 
                            ? `${request.payment_percentage}%` 
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.shipment_date 
                            ? format(new Date(request.shipment_date), "dd.MM.yy")
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.delivery_date 
                            ? format(new Date(request.delivery_date), "dd.MM.yy")
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.transport_company || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.waybill_number || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 max-w-[100px]">
                        <div className="line-clamp-2">
                          {request.applicant || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell max-w-[120px]">
                        <div className="line-clamp-2">
                          {request.comments || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.executor || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center border-r p-1 hidden xl:table-cell">
                        <div className="line-clamp-2">
                          {request.document_url ? "Есть" : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center p-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteClick(request, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-medium">Заявки не найдены</p>
            <p className="text-muted-foreground">
              Попробуйте изменить фильтры или импортировать данные
            </p>
          </div>
        )}
      </Card>
        </TabsContent>
      </Tabs>

      {canCreate && (
        <>
          <CreateRequestDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <span className="hidden" />
          </CreateRequestDialog>
          
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
          
          <Button
            onClick={() => navigate("/chat")}
            className="fixed bottom-6 right-24 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            size="icon"
            variant="secondary"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </>
      )}

      {selectedRequest && (
        <EditRequestDialog 
          request={selectedRequest}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      {selectedRequestIds.size > 0 && (
        <Button
          onClick={handleSendToTelegram}
          disabled={isSending}
          className="fixed bottom-6 right-24 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50 bg-primary hover:bg-primary/90"
          size="icon"
        >
          <Send className="h-6 w-6" />
        </Button>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Переместить в архив</AlertDialogTitle>
            <AlertDialogDescription>
              Вы действительно хотите переместить заявку "{requestToDelete?.description}" в архив?
              Архивированные заявки не будут отображаться в основном списке.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              В архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Requests;
