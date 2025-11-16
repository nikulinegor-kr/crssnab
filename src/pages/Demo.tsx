import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, AlertCircle, CheckCircle, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EditRequestDialog } from "@/components/EditRequestDialog";
import type { Request } from "@/hooks/useRequests";
import { RequestsAnalytics } from "@/components/RequestsAnalytics";
import { EmergencyRequestsWidget } from "@/components/dashboard/EmergencyRequestsWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { useDemoData } from "@/hooks/useDemoData";
import { DemoBanner } from "@/components/DemoBanner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

const Demo = () => {
  const navigate = useNavigate();
  const demoData = useDemoData();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [view, setView] = useState<"dashboard" | "requests">("dashboard");
  
  // Requests filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const requests = demoData.requests;
  const stats = demoData.stats;

  const statsCards = [
    {
      title: "Всего заявок",
      value: stats.total.toString(),
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Новые сегодня",
      value: stats.newToday.toString(),
      icon: Clock,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Аварийно",
      value: stats.emergency.toString(),
      icon: AlertCircle,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Выполнено",
      value: stats.completed.toString(),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const recentRequests = requests?.slice(0, 3) || [];

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Доставлено": return "text-success";
      case "Доставлено в ТК": return "text-success";
      case "Выполнено": return "text-success";
      case "В работе": return "text-info";
      case "На согласовании": return "text-warning";
      case "КП": return "text-warning";
      case "Новая заявка": return "text-primary";
      default: return "text-muted-foreground";
    }
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

  const years = Array.from(
    new Set(requests?.map((r) => r.request_date.split("-")[0]))
  ).sort().reverse();

  const statuses = [
    "Новая заявка",
    "На согласовании",
    "КП",
    "В работе",
    "Доставлено в ТК",
    "Доставлено",
    "Выполнено",
  ];

  const priorities = ["Плановая", "Срочная", "Аварийно"];

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Доставлено":
      case "Доставлено в ТК":
      case "Выполнено":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "Новая заявка":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "На согласовании":
      case "КП":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "В работе":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "Аварийно":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "Срочная":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <DemoBanner />

        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={view === "dashboard" ? "default" : "outline"}
            onClick={() => setView("dashboard")}
          >
            Дашборд
          </Button>
          <Button
            variant={view === "requests" ? "default" : "outline"}
            onClick={() => setView("requests")}
          >
            Все заявки
          </Button>
        </div>

        {view === "dashboard" ? (
          <>
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statsCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.title} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {stat.title}
                      </CardTitle>
                      <div className={`${stat.bgColor} p-2 rounded-full`}>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Analytics and Widgets */}
            <RequestsAnalytics 
              requests={requests || []} 
              onEmergencyClick={() => {}}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <CalendarWidget requests={requests || []} />
              <EmergencyRequestsWidget 
                requests={requests || []} 
                onRequestClick={handleRequestClick}
              />
            </div>

            {/* Recent Requests */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Последние заявки</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setView("requests")}>
                  Смотреть все
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      onClick={() => handleRequestClick(request)}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{request.description}</p>
                        <p className="text-sm text-muted-foreground">
                          № {request.request_number} • {format(new Date(request.request_date), "dd.MM.yyyy")}
                        </p>
                      </div>
                      <span className={`text-sm font-medium ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Requests View */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Все заявки</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Найдено: {filteredRequests?.length || 0}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по описанию или номеру..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="min-w-[120px]">
                        Статус {statusFilter.length > 0 && `(${statusFilter.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Статус заявки</h4>
                          {statusFilter.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStatusFilter([])}
                              className="h-8 px-2"
                            >
                              Сбросить
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {statuses.map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                              <Checkbox
                                id={status}
                                checked={statusFilter.includes(status)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setStatusFilter([...statusFilter, status]);
                                  } else {
                                    setStatusFilter(statusFilter.filter((s) => s !== status));
                                  }
                                }}
                              />
                              <Label htmlFor={status} className="text-sm cursor-pointer">
                                {status}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="min-w-[120px]">
                      <SelectValue placeholder="Приоритет" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="min-w-[120px]">
                      <SelectValue placeholder="Год" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все года</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Номер</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Исполнитель</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests?.map((request) => (
                        <TableRow
                          key={request.id}
                          onClick={() => handleRequestClick(request)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {request.request_number}
                          </TableCell>
                          <TableCell>
                            {format(new Date(request.request_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {request.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadgeColor(request.status)}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.priority && (
                              <Badge variant="outline" className={getPriorityColor(request.priority)}>
                                {request.priority}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{request.executor || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredRequests?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Заявки не найдены
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {editDialogOpen && selectedRequest && (
          <EditRequestDialog
            request={selectedRequest}
            open={editDialogOpen}
            onOpenChange={handleEditDialogClose}
          />
        )}
      </div>
    </div>
  );
};

export default Demo;
