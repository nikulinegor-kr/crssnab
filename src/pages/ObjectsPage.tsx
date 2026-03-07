import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequests } from "@/hooks/useRequests";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, AlertCircle, Plus, Warehouse, Trash2 } from "lucide-react";

const ObjectsPage = () => {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useRequests();
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseDescription, setNewWarehouseDescription] = useState("");

  // Fetch objects from request_objects table
  const { data: objects = [] } = useQuery({
    queryKey: ["request-objects", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const objectsData = useMemo(() => {
    if (!objects) return [];

    return objects
      .filter((o) => {
        if (!search) return true;
        return o.name.toLowerCase().includes(search.toLowerCase());
      })
      .map((obj) => {
        const objRequests = requests?.filter((r) => r.object_id === obj.id) || [];
        const emergencyRequests = objRequests.filter((r) => r.priority === "Аварийно").length;
        const objWarehouses = warehouses.filter((w: any) => w.object_id === obj.id);

        let avgDeliveryDays = 0;
        let deliveryCount = 0;
        objRequests.forEach((r) => {
          if (r.shipment_date && r.delivery_date) {
            const days = Math.ceil(
              (new Date(r.delivery_date).getTime() - new Date(r.shipment_date).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (days > 0) {
              avgDeliveryDays = (avgDeliveryDays * deliveryCount + days) / (deliveryCount + 1);
              deliveryCount++;
            }
          }
        });

        return {
          id: obj.id,
          name: obj.name,
          address: obj.address,
          totalRequests: objRequests.length,
          emergencyRequests,
          avgDeliveryDays,
          deliveryCount,
          warehouses: objWarehouses,
        };
      })
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [objects, requests, search, warehouses]);

  const createWarehouse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouses").insert({
        organization_id: currentOrgId!,
        name: newWarehouseName,
        description: newWarehouseDescription || null,
        object_id: selectedObjectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setShowWarehouseDialog(false);
      setNewWarehouseName("");
      setNewWarehouseDescription("");
      toast({ title: "Склад создан" });
    },
    onError: () => toast({ title: "Ошибка создания склада", variant: "destructive" }),
  });

  const deleteWarehouse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast({ title: "Склад удалён" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const handleAddWarehouse = (objectId: string) => {
    setSelectedObjectId(objectId);
    setNewWarehouseName("");
    setNewWarehouseDescription("");
    setShowWarehouseDialog(true);
  };

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

      {/* Objects list */}
      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        ) : objectsData.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Объекты не найдены
            </CardContent>
          </Card>
        ) : (
          objectsData.map((obj) => (
            <Card key={obj.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold">{obj.name}</CardTitle>
                    {obj.address && (
                      <p className="text-xs text-muted-foreground mt-0.5">{obj.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{obj.totalRequests} заявок</Badge>
                    {obj.emergencyRequests > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {obj.emergencyRequests}
                      </Badge>
                    )}
                    {obj.deliveryCount > 0 && (
                      <Badge variant="outline">~{Math.round(obj.avgDeliveryDays)} дн.</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Warehouses block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <Warehouse className="h-4 w-4 text-muted-foreground" />
                      Склады объекта
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleAddWarehouse(obj.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить склад
                    </Button>
                  </div>

                  {obj.warehouses.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Название склада</TableHead>
                            <TableHead className="text-xs">Описание</TableHead>
                            <TableHead className="text-xs w-[80px]">Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {obj.warehouses.map((w: any) => (
                            <TableRow key={w.id}>
                              <TableCell className="text-sm font-medium">{w.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{w.description || "—"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => deleteWarehouse.mutate(w.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">Нет складов</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый склад</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название склада</Label>
              <Input
                value={newWarehouseName}
                onChange={(e) => setNewWarehouseName(e.target.value)}
                placeholder="Основной склад"
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Textarea
                value={newWarehouseDescription}
                onChange={(e) => setNewWarehouseDescription(e.target.value)}
                placeholder="Описание склада..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createWarehouse.mutate()}
              disabled={!newWarehouseName.trim() || createWarehouse.isPending}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ObjectsPage;
