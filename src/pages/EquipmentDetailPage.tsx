import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Truck, Wrench, FileText, DollarSign, Cog, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();
  const [partsSearch, setPartsSearch] = useState("");

  const { data: equipment } = useQuery({
    queryKey: ["equipment-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["equipment-requests-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, priority, created_at, request_type, amount")
        .eq("equipment_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requestItems = [] } = useQuery({
    queryKey: ["equipment-request-items", id, requests.map((r) => r.id)],
    queryFn: async () => {
      if (requests.length === 0) return [];
      const requestIds = requests.map((r) => r.id);
      const { data, error } = await supabase
        .from("request_items")
        .select("*")
        .in("request_id", requestIds);
      if (error) throw error;
      return data;
    },
    enabled: requests.length > 0,
  });

  const totalCost = useMemo(() => {
    return requests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [requests]);

  const lastRepairDate = useMemo(() => {
    if (requests.length === 0) return null;
    return requests[0]?.created_at;
  }, [requests]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((r) => {
      if (!r.created_at || !r.amount) return;
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + Number(r.amount));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, amount]) => {
        const [y, m] = key.split("-");
        const date = new Date(Number(y), Number(m) - 1);
        return {
          month: format(date, "MMM yy", { locale: ru }),
          amount,
        };
      });
  }, [requests]);

  // Build request date map for items
  const requestDateMap = useMemo(() => {
    const map = new Map<string, { created_at: string; request_number: string }>();
    requests.forEach((r) => map.set(r.id, { created_at: r.created_at || "", request_number: r.request_number }));
    return map;
  }, [requests]);

  // Service history
  const serviceHistory = useMemo(() => {
    const itemsByRequest = new Map<string, typeof requestItems>();
    requestItems.forEach((item) => {
      const list = itemsByRequest.get(item.request_id) || [];
      list.push(item);
      itemsByRequest.set(item.request_id, list);
    });

    const rows: Array<{
      date: string;
      requestNumber: string;
      requestId: string;
      itemName: string;
      quantity: number;
      cost: number;
    }> = [];

    requests.forEach((r) => {
      const items = itemsByRequest.get(r.id);
      if (items && items.length > 0) {
        items.forEach((item) => {
          rows.push({
            date: r.created_at || "",
            requestNumber: r.request_number,
            requestId: r.id,
            itemName: item.name,
            quantity: item.quantity,
            cost: 0,
          });
        });
      } else {
        rows.push({
          date: r.created_at || "",
          requestNumber: r.request_number,
          requestId: r.id,
          itemName: r.description?.slice(0, 60) || "—",
          quantity: 1,
          cost: Number(r.amount) || 0,
        });
      }
    });

    return rows;
  }, [requests, requestItems]);

  // Spare parts catalog - aggregate by article+name
  const partsCatalog = useMemo(() => {
    const map = new Map<string, {
      article: string;
      name: string;
      usageCount: number;
      totalQuantity: number;
      lastUsedAt: string;
    }>();

    requestItems.forEach((item) => {
      const key = `${(item.article || "").toLowerCase().trim()}|${item.name.toLowerCase().trim()}`;
      const existing = map.get(key);
      const reqInfo = requestDateMap.get(item.request_id);
      const itemDate = reqInfo?.created_at || "";

      if (existing) {
        existing.usageCount += 1;
        existing.totalQuantity += item.quantity;
        if (itemDate > existing.lastUsedAt) {
          existing.lastUsedAt = itemDate;
        }
      } else {
        map.set(key, {
          article: item.article || "—",
          name: item.name,
          usageCount: 1,
          totalQuantity: item.quantity,
          lastUsedAt: itemDate,
        });
      }
    });

    let result = Array.from(map.values()).sort((a, b) => b.usageCount - a.usageCount);

    if (partsSearch) {
      const words = partsSearch.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const haystack = `${p.article} ${p.name}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }

    return result;
  }, [requestItems, requestDateMap, partsSearch]);

  const label = equipment ? `${equipment.brand} ${equipment.model}` : "...";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/equipment")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Truck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{label}</h1>
          {equipment && (
            <p className="text-sm text-muted-foreground">
              {[equipment.plate_number, equipment.vin, equipment.year].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Всего потрачено</p>
              <p className="text-xl font-bold">{totalCost.toLocaleString("ru-RU")} ₽</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Заявок</p>
              <p className="text-xl font-bold">{requests.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Последний ремонт</p>
              <p className="text-xl font-bold">
                {lastRepairDate ? format(new Date(lastRepairDate), "dd.MM.yyyy") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics" className="gap-1.5">
            <DollarSign className="h-4 w-4" />
            Аналитика
          </TabsTrigger>
          <TabsTrigger value="parts" className="gap-1.5">
            <Cog className="h-4 w-4" />
            Каталог запчастей
            {partsCatalog.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{partsCatalog.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Monthly Chart */}
          {monthlyData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Расходы по месяцам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString("ru-RU")} ₽`, "Сумма"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service History Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">История обслуживания</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Нет связанных заявок</p>
              ) : (
                <div className="rounded-md border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Заявка</TableHead>
                        <TableHead>Товар / позиция</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                        <TableHead className="text-right">Стоимость</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceHistory.map((row, i) => (
                        <TableRow
                          key={i}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/requests/${row.requestId}`)}
                        >
                          <TableCell className="text-sm">
                            {row.date ? format(new Date(row.date), "dd.MM.yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">{row.requestNumber}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate">{row.itemName}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right font-medium">
                            {row.cost > 0 ? `${row.cost.toLocaleString("ru-RU")} ₽` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spare Parts Catalog Tab */}
        <TabsContent value="parts" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по артикулу или названию..."
              value={partsSearch}
              onChange={(e) => setPartsSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Каталог запчастей
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  (формируется автоматически из заявок)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partsCatalog.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {partsSearch ? "Ничего не найдено" : "Нет запчастей — они появятся автоматически из заявок"}
                </p>
              ) : (
                <div className="rounded-md border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Артикул</TableHead>
                        <TableHead>Наименование</TableHead>
                        <TableHead className="text-right">Использований</TableHead>
                        <TableHead className="text-right">Общее кол-во</TableHead>
                        <TableHead>Последнее использование</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsCatalog.map((part, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{part.article}</TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate">{part.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{part.usageCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{part.totalQuantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {part.lastUsedAt ? format(new Date(part.lastUsedAt), "dd.MM.yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
