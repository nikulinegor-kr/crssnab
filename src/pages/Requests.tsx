import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
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
import { Search, Plus, ArrowLeft, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

const Requests = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: requests, isLoading } = useRequests();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

  const handleRowClick = (request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.request_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(request.status);
    const matchesPriority =
      priorityFilter === "all" || request.priority === priorityFilter;
    const matchesYear =
      yearFilter === "all" ||
      request.request_date.startsWith(yearFilter);
    return matchesSearch && matchesStatus && matchesPriority && matchesYear;
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

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Все заявки</h1>
            <p className="text-muted-foreground">
              {filteredRequests?.length || 0} заявок найдено
            </p>
          </div>
        </div>
        <CreateRequestDialog>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Создать заявку
          </Button>
        </CreateRequestDialog>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по описанию или номеру..."
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Выберите статусы</Label>
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
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredRequests && filteredRequests.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap w-20">Дата</TableHead>
                  <TableHead className="min-w-[200px]">Заявка</TableHead>
                  <TableHead className="w-24">Приоритет</TableHead>
                  <TableHead className="w-32">Статус</TableHead>
                  <TableHead className="w-32">Наличие</TableHead>
                  <TableHead className="w-40">Контрагент</TableHead>
                  <TableHead className="w-24">Счет</TableHead>
                  <TableHead className="w-20">Оплата</TableHead>
                  <TableHead className="w-20">ДатаО</TableHead>
                  <TableHead className="w-20">ДатаД</TableHead>
                  <TableHead className="w-32">ТК</TableHead>
                  <TableHead className="w-24">№ ТТН</TableHead>
                  <TableHead className="w-32">Заявитель</TableHead>
                  <TableHead className="w-40">Комментарий</TableHead>
                  <TableHead className="w-32">Исполнитель</TableHead>
                  <TableHead className="w-24">Счёт/Кп</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow 
                    key={request.id} 
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleRowClick(request)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2 min-w-[200px]">
                        {request.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge 
                        variant={request.priority === "Аварийно" ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge className={`${getStatusColor(request.status)} text-[10px] px-1.5 py-0.5`}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.availability_delivery_time || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.contractor || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {request.invoice_number || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {request.payment_percentage}%
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {request.shipment_date
                        ? format(new Date(request.shipment_date), "dd.MM.yy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {request.delivery_date
                        ? format(new Date(request.delivery_date), "dd.MM.yy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.transport_company || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {request.waybill_number || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.applicant || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.comments || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2">
                        {request.executor || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {(request.photo_url || request.document_url) ? "📎" : "-"}
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

      <EditRequestDialog 
        request={selectedRequest}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};

export default Requests;
