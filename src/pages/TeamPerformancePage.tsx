import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ArrowLeft, FileText, CheckCircle, Clock, AlertTriangle, TrendingUp, DollarSign, Timer, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, subDays, startOfMonth, isAfter, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { ExecutorDaySummary } from "@/components/analytics/ExecutorDaySummary";

const PERIOD_OPTIONS = [
  { value: "today", label: "День" },
  { value: "2d", label: "2 дня" },
  { value: "3d", label: "3 дня" },
  { value: "7d", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "30d", label: "30 дней" },
  { value: "all", label: "Всё время" },
];

const FINAL_STATUSES = ["Доставлено", "Оплачено", "Выполнено", "Закрыто"];

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "2d": return subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    case "3d": return subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 2);
    case "7d": return subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 6);
    case "30d": return subDays(now, 30);
    case "month": return startOfMonth(now);
    case "all": return null;
    default: return null;
  }
}

const TeamPerformancePage = () => {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedExecutor = searchParams.get("executor");
  const [period, setPeriod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch all requests for the org
  const { data: requests, isLoading } = useQuery({
    queryKey: ["team-performance-requests", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("requests")
          .select("id, request_number, description, status, priority, executor, applicant, amount, created_at, updated_at, delivery_date, object_id, archived, request_objects(name)")
          .eq("organization_id", currentOrgId)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData;
    },
    enabled: !!currentOrgId,
  });

  // Get unique executors
  const executors = useMemo(() => {
    if (!requests) return [];
    const names = [...new Set(requests.map(r => r.executor).filter(Boolean))];
    return names.sort();
  }, [requests]);

  // Filter by period
  const periodStart = getPeriodStart(period);
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => {
      if (periodStart && !isAfter(new Date(r.created_at), periodStart)) return false;
      return true;
    });
  }, [requests, periodStart]);

  // Executor stats
  const executorStats = useMemo(() => {
    return executors.map(name => {
      const reqs = filteredRequests.filter(r => r.executor === name);
      const total = reqs.length;
      const completed = reqs.filter(r => FINAL_STATUSES.includes(r.status)).length;
      const inProgress = reqs.filter(r => !FINAL_STATUSES.includes(r.status) && !r.archived).length;
      const overdue = reqs.filter(r => {
        if (!r.delivery_date || FINAL_STATUSES.includes(r.status)) return false;
        return new Date(r.delivery_date) < new Date();
      }).length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const totalAmount = reqs.reduce((sum, r) => sum + (r.amount || 0), 0);

      // Avg time (days from created to last completed status)
      const completedReqs = reqs.filter(r => FINAL_STATUSES.includes(r.status));
      const avgDays = completedReqs.length > 0
        ? Math.round(completedReqs.reduce((sum, r) => sum + differenceInDays(new Date(r.updated_at), new Date(r.created_at)), 0) / completedReqs.length)
        : 0;

      return { name, total, completed, inProgress, overdue, completionRate, totalAmount, avgDays };
    });
  }, [executors, filteredRequests]);

  // Selected executor detail
  const selectedStats = executorStats.find(e => e.name === selectedExecutor);
  const selectedRequests = useMemo(() => {
    if (!selectedExecutor) return [];
    let reqs = filteredRequests.filter(r => r.executor === selectedExecutor);
    if (statusFilter !== "all") {
      reqs = reqs.filter(r => r.status === statusFilter);
    }
    return reqs;
  }, [filteredRequests, selectedExecutor, statusFilter]);

  const allStatuses = useMemo(() => {
    if (!selectedExecutor) return [];
    const reqs = filteredRequests.filter(r => r.executor === selectedExecutor);
    return [...new Set(reqs.map(r => r.status))].sort();
  }, [filteredRequests, selectedExecutor]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedExecutor && (
            <Button variant="ghost" size="icon" onClick={() => setSearchParams({})}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedExecutor ? selectedExecutor : "Производительность команды"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedExecutor ? "Детальная аналитика исполнителя" : "Контроль работы исполнителей"}
            </p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedExecutor ? (
        /* EXECUTOR LIST */
        <div className="grid gap-4">
          {executorStats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Нет исполнителей с назначенными заявками
              </CardContent>
            </Card>
          ) : (
            executorStats.map(stat => (
              <Card
                key={stat.name}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSearchParams({ executor: stat.name })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{stat.name}</h3>
                    <Badge variant={stat.overdue > 0 ? "destructive" : "default"}>
                      {stat.completionRate}% выполнения
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Всего</p>
                      <p className="font-semibold text-lg">{stat.total}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Выполнено</p>
                      <p className="font-semibold text-lg text-green-600">{stat.completed}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">В работе</p>
                      <p className="font-semibold text-lg text-blue-600">{stat.inProgress}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Просрочено</p>
                      <p className={`font-semibold text-lg ${stat.overdue > 0 ? "text-red-600" : ""}`}>{stat.overdue}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">% выполн.</p>
                      <p className="font-semibold text-lg">{stat.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ср. время</p>
                      <p className="font-semibold text-lg">{stat.avgDays} дн.</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Сумма</p>
                      <p className="font-semibold text-lg">{stat.totalAmount.toLocaleString("ru-RU")} ₽</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* EXECUTOR DETAIL */
        <>
          {/* KPI Cards */}
          {selectedStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { title: "Всего", value: selectedStats.total, icon: FileText, color: "text-foreground", filter: "all" },
                { title: "Выполнено", value: selectedStats.completed, icon: CheckCircle, color: "text-green-600", filter: "completed" },
                { title: "В работе", value: selectedStats.inProgress, icon: Clock, color: "text-blue-600", filter: "inProgress" },
                { title: "Просрочено", value: selectedStats.overdue, icon: AlertTriangle, color: selectedStats.overdue > 0 ? "text-red-600" : "text-foreground", filter: "overdue" },
                { title: "% выполн.", value: `${selectedStats.completionRate}%`, icon: TrendingUp, color: "text-foreground" },
                { title: "Ср. время", value: `${selectedStats.avgDays} дн.`, icon: Timer, color: "text-foreground" },
                { title: "Сумма", value: `${selectedStats.totalAmount.toLocaleString("ru-RU")} ₽`, icon: DollarSign, color: "text-foreground" },
              ].map((card, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer hover:border-primary/50 transition-colors ${card.filter === statusFilter ? "border-primary" : ""}`}
                  onClick={() => {
                    if (card.filter) setStatusFilter(card.filter === statusFilter ? "all" : card.filter);
                  }}
                >
                  <CardContent className="p-3 text-center">
                    <card.icon className={`h-5 w-5 mx-auto mb-1 ${card.color}`} />
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <ExecutorDaySummary executorName={selectedExecutor} />



          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              Все
            </Button>
            {allStatuses.map(status => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Button>
            ))}
          </div>

          {/* Requests table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-480px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Номер</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Приоритет</TableHead>
                      <TableHead>Объект</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Создана</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Заявок не найдено
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedRequests.map(req => (
                        <TableRow
                          key={req.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/requests/${req.id}`)}
                        >
                          <TableCell className="font-medium text-primary">{req.request_number}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{req.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{req.status}</Badge>
                          </TableCell>
                          <TableCell>{req.priority}</TableCell>
                          <TableCell>{req.request_objects?.name || "—"}</TableCell>
                          <TableCell>{req.amount ? `${req.amount.toLocaleString("ru-RU")} ₽` : "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(req.created_at), "dd.MM.yyyy", { locale: ru })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TeamPerformancePage;
