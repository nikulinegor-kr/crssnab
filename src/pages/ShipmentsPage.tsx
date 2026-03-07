import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const ShipmentsPage = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useRequests();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");

  // Filter requests that have shipment or delivery data
  const shipments = useMemo(() => {
    if (!requests) return [];
    return requests
      .filter(r => r.shipment_date || r.delivery_date || r.transport_company || r.waybill_number)
      .filter(r => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (contractorFilter !== "all" && r.contractor !== contractorFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            r.description?.toLowerCase().includes(q) ||
            r.contractor?.toLowerCase().includes(q) ||
            r.transport_company?.toLowerCase().includes(q) ||
            r.waybill_number?.toLowerCase().includes(q) ||
            r.request_number?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.shipment_date || a.delivery_date || "";
        const dateB = b.shipment_date || b.delivery_date || "";
        return dateB.localeCompare(dateA);
      });
  }, [requests, search, statusFilter, contractorFilter]);

  const uniqueStatuses = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.filter(r => r.status).map(r => r.status))];
  }, [requests]);

  const uniqueContractors = useMemo(() => {
    if (!requests) return [];
    return [...new Set(requests.filter(r => r.contractor).map(r => r.contractor!))];
  }, [requests]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "В пути": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Доставлено": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Доставлено в ТК": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="w-full p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Поставки</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {shipments.length} поставок
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по контрагенту, ТК, ТТН..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={contractorFilter} onValueChange={setContractorFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Контрагент" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все контрагенты</SelectItem>
            {uniqueContractors.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {uniqueStatuses.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[100px]">№ заявки</TableHead>
                <TableHead>Дата отгрузки</TableHead>
                <TableHead>Дата доставки</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead>Транспортная компания</TableHead>
                <TableHead>ТТН</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Поставки не найдены
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/40 transition-colors"
                    onClick={() => navigate(`/requests/${r.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                    <TableCell className="text-sm">
                      {r.shipment_date ? format(new Date(r.shipment_date), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.delivery_date ? format(new Date(r.delivery_date), "dd.MM.yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.contractor || "—"}</TableCell>
                    <TableCell className="text-sm">{r.transport_company || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{r.waybill_number || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusBadgeColor(r.status)}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ShipmentsPage;
