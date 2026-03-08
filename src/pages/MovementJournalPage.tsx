import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const TYPE_LABELS: Record<string, string> = {
  IN: "Приход",
  OUT: "Списание",
  RESERVE: "Резерв",
  UNRESERVE: "Снятие резерва",
  MOVE_IN: "Перемещение (приход)",
  MOVE_OUT: "Перемещение (расход)",
  IN_TRANSIT: "В пути",
  INVENTORY: "Инвентаризация",
};

const TYPE_COLORS: Record<string, string> = {
  IN: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OUT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  RESERVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  UNRESERVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MOVE_IN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  MOVE_OUT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  IN_TRANSIT: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  INVENTORY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function MovementJournalPage() {
  const { currentOrgId } = useCurrentOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements-journal", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, warehouse_products(name, article), warehouses(name, request_objects(name)), requests(request_number, description)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const filtered = useMemo(() => {
    return movements.filter((m: any) => {
      const matchesSearch = !search || 
        m.warehouse_products?.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.warehouse_products?.article?.toLowerCase().includes(search.toLowerCase()) ||
        m.warehouses?.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.comment?.toLowerCase().includes(search.toLowerCase()) ||
        m.requests?.request_number?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      const matchesWarehouse = warehouseFilter === "all" || m.warehouse_id === warehouseFilter;
      return matchesSearch && matchesType && matchesWarehouse;
    });
  }, [movements, search, typeFilter, warehouseFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Журнал движений</h1>
        <span className="text-muted-foreground text-sm">({filtered.length})</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по товару, складу, заявке..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Тип операции" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все операции</SelectItem>
              <SelectItem value="IN">Приход</SelectItem>
              <SelectItem value="OUT">Списание</SelectItem>
              <SelectItem value="MOVE_IN">Перемещение (приход)</SelectItem>
              <SelectItem value="MOVE_OUT">Перемещение (расход)</SelectItem>
              <SelectItem value="RESERVE">Резерв</SelectItem>
              <SelectItem value="UNRESERVE">Снятие резерва</SelectItem>
              <SelectItem value="IN_TRANSIT">В пути</SelectItem>
              <SelectItem value="INVENTORY">Инвентаризация</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Склад" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все склады</SelectItem>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Товар</TableHead>
              <TableHead>Операция</TableHead>
              <TableHead className="text-right">Количество</TableHead>
              <TableHead>Склад</TableHead>
              <TableHead>Связанная заявка</TableHead>
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Нет движений
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(m.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>
                      {m.warehouse_products?.name || "—"}
                      {m.warehouse_products?.article && (
                        <span className="text-muted-foreground text-xs ml-1">({m.warehouse_products.article})</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={TYPE_COLORS[m.type] || ""}>
                      {TYPE_LABELS[m.type] || m.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                  <TableCell>{m.warehouses?.name || "—"}</TableCell>
                  <TableCell>
                    {m.requests ? (
                      <button
                        className="text-primary hover:underline text-sm"
                        onClick={() => navigate(`/requests/${m.request_id}`)}
                      >
                        #{m.requests.request_number} — {m.requests.description?.slice(0, 30) || ""}
                      </button>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {m.comment || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
