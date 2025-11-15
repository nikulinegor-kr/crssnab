import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Search, Plus, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CreateRequestDialog } from "@/components/CreateRequestDialog";

const Requests = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useRequests();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.request_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || request.status === statusFilter;
    const matchesYear =
      yearFilter === "all" ||
      request.request_date.startsWith(yearFilter);
    return matchesSearch && matchesStatus && matchesYear;
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

  return (
    <div className="container mx-auto p-6 space-y-6">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
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
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Заявитель</TableHead>
                  <TableHead>Исполнитель</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Приоритет</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Наличие/Сроки</TableHead>
                  <TableHead>Счет</TableHead>
                  <TableHead>Оплата</TableHead>
                  <TableHead>Отгрузка</TableHead>
                  <TableHead>Доставка</TableHead>
                  <TableHead>ТК</TableHead>
                  <TableHead>ТТН</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(request.request_date), "dd.MM.yy")}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {request.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.applicant || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.executor || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={request.priority === "Аварийно" ? "destructive" : "outline"}>
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.contractor || "-"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {request.availability_delivery_time || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.invoice_number || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {request.payment_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.shipment_date
                        ? format(new Date(request.shipment_date), "dd.MM.yy")
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.delivery_date
                        ? format(new Date(request.delivery_date), "dd.MM.yy")
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.transport_company || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {request.waybill_number || "-"}
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
    </div>
  );
};

export default Requests;
