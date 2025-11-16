import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Plus, X, Send } from "lucide-react";
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

const Requests = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: requests, isLoading } = useRequests();
  const { canCreate } = useUserRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hideDelivered, setHideDelivered] = useState(true);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Apply filters from URL params on mount
  useEffect(() => {
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const isNew = searchParams.get("new");
    
    if (status) {
      setStatusFilter([status]);
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
    setSelectedRequest(request);
    setEditDialogOpen(true);
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
      let successCount = 0;
      let errorCount = 0;

      for (const requestId of Array.from(selectedRequestIds)) {
        try {
          const { error } = await supabase.functions.invoke('notify-telegram', {
            body: { requestId }
          });

          if (error) throw error;
          successCount++;
        } catch (err) {
          console.error(`Error sending request ${requestId}:`, err);
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
        throw new Error("Не удалось отправить ни одной заявки");
      }
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить заявки в Telegram",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
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
    const matchesDelivered =
      !hideDelivered || request.status !== "Доставлено";
    return matchesSearch && matchesStatus && matchesPriority && matchesYear && matchesDelivered;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Доставлено":
      case "Доставлено в ТК":
      case "Выполнено":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "Новая заявка":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "На согласовании":
      case "КП":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "Счёт":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "В работе":
      case "В пути":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const years = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
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

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Все заявки</h1>
          <p className="text-sm text-muted-foreground">
            {filteredRequests?.length || 0} заявок найдено
          </p>
        </div>
        <div className="flex gap-2">
          {selectedRequestIds.size > 0 && (
            <Button 
              onClick={handleSendToTelegram}
              disabled={isSending}
              className="gap-2" 
              size="sm"
              variant="default"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">
                Отправить ({selectedRequestIds.size})
              </span>
            </Button>
          )}
          {requests && requests.length > 0 && (
            <ExcelExportButton 
              requests={requests} 
              filteredRequests={filteredRequests}
            />
          )}
          {canCreate && (
            <CreateRequestDialog>
              <Button className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Создать заявку</span>
              </Button>
            </CreateRequestDialog>
          )}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-[200px] justify-between">
                {statusFilter.length === 0 
                  ? "Все статусы" 
                  : `Статусы (${statusFilter.length})`}
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
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Все приоритеты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              {priorities.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Все годы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все годы</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-md">
            <Checkbox
              id="hideDelivered"
              checked={hideDelivered}
              onCheckedChange={(checked) => setHideDelivered(checked as boolean)}
            />
            <Label htmlFor="hideDelivered" className="cursor-pointer text-sm">
              Скрыть доставленные
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredRequests && filteredRequests.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table className="w-full table-auto border-collapse">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/50 border-b">
                  <TableHead className="w-12 text-center border-r">
                    <Checkbox
                      checked={selectedRequestIds.size === filteredRequests?.length && filteredRequests.length > 0}
                      onCheckedChange={toggleAllRequests}
                    />
                  </TableHead>
                  <TableHead className="text-center border-r">Дата</TableHead>
                  <TableHead className="text-center border-r">Заявка</TableHead>
                  <TableHead className="text-center border-r">Приоритет</TableHead>
                  <TableHead className="text-center border-r">Статус</TableHead>
                  <TableHead className="text-center border-r">Наличие</TableHead>
                  <TableHead className="text-center border-r">Контрагент</TableHead>
                  <TableHead className="text-center border-r">Счёт</TableHead>
                  <TableHead className="text-center border-r">Оплата</TableHead>
                  <TableHead className="text-center border-r">ДатаО</TableHead>
                  <TableHead className="text-center border-r">ДатаД</TableHead>
                  <TableHead className="text-center border-r">ТК</TableHead>
                  <TableHead className="text-center border-r">№ ТТН</TableHead>
                  <TableHead className="text-center border-r">Заявитель</TableHead>
                  <TableHead className="text-center border-r">Комментарий</TableHead>
                  <TableHead className="text-center border-r">Исполнитель</TableHead>
                  <TableHead className="text-center">Счёт/КП</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow 
                    key={request.id} 
                    className="hover:bg-muted/30 cursor-pointer border-b"
                    onClick={(e) => handleRowClick(request, e)}
                  >
                    <TableCell className="text-xs text-center border-r" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRequestIds.has(request.id)}
                        onCheckedChange={() => toggleRequestSelection(request.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {format(new Date(request.request_date), "dd.MM.yy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <Badge 
                        variant={request.priority === "Аварийно" ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(request.status)} text-[10px] px-1.5 py-0.5`}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.availability_delivery_time || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.contractor || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.invoice_number || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.payment_percentage}%
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.shipment_date
                          ? format(new Date(request.shipment_date), "dd.MM.yy")
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.delivery_date
                          ? format(new Date(request.delivery_date), "dd.MM.yy")
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.transport_company || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.waybill_number || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.applicant || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.comments || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center border-r">
                      <div className="line-clamp-2">
                        {request.executor || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center" onClick={(e) => e.stopPropagation()}>
                      {request.document_url ? (
                        <a 
                          href={request.document_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Открыть
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-medium">Заявки не найдены</p>
            <p className="text-muted-foreground">
              Попробуйте изменить фильтры или импортировать данные
            </p>
          </div>
        )}
      </Card>

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
        </>
      )}

      {selectedRequest && (
        <EditRequestDialog 
          request={selectedRequest}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </div>
  );
};

export default Requests;
