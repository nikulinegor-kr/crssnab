import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRequests } from "@/hooks/useRequests";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, AlertCircle } from "lucide-react";

const ObjectsPage = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useRequests();
  const [search, setSearch] = useState("");

  const objectsData = useMemo(() => {
    if (!requests) return [];
    
    const objectMap = new Map<string, {
      id: string;
      name: string;
      totalRequests: number;
      emergencyRequests: number;
      avgDeliveryDays: number;
      deliveryCount: number;
    }>();

    requests.forEach(r => {
      if (!r.object_id) return;
      const objName = (r as any).request_objects?.name || r.object_id;
      
      if (!objectMap.has(r.object_id)) {
        objectMap.set(r.object_id, {
          id: r.object_id,
          name: objName,
          totalRequests: 0,
          emergencyRequests: 0,
          avgDeliveryDays: 0,
          deliveryCount: 0,
        });
      }
      
      const obj = objectMap.get(r.object_id)!;
      obj.totalRequests++;
      if (r.priority === "Аварийно") obj.emergencyRequests++;
      
      if (r.shipment_date && r.delivery_date) {
        const days = Math.ceil(
          (new Date(r.delivery_date).getTime() - new Date(r.shipment_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (days > 0) {
          obj.avgDeliveryDays = (obj.avgDeliveryDays * obj.deliveryCount + days) / (obj.deliveryCount + 1);
          obj.deliveryCount++;
        }
      }
    });

    return Array.from(objectMap.values())
      .filter(o => {
        if (!search) return true;
        return o.name.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [requests, search]);

  return (
    <div className="w-full p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Объекты</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {objectsData.length} объектов
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск объекта..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Объект</TableHead>
                <TableHead className="text-center">Заявки</TableHead>
                <TableHead className="text-center">Аварийные</TableHead>
                <TableHead className="text-center">Ср. срок доставки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(4)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : objectsData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Объекты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                objectsData.map((obj) => (
                  <TableRow key={obj.id} className="hover:bg-accent/40 transition-colors">
                    <TableCell className="font-medium">{obj.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{obj.totalRequests}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {obj.emergencyRequests > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {obj.emergencyRequests}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {obj.deliveryCount > 0 ? `${Math.round(obj.avgDeliveryDays)} дн.` : "—"}
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

export default ObjectsPage;
