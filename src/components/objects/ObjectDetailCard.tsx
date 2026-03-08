import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useRequests } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Warehouse, FileText, Truck, DollarSign, Info } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface ObjectDetailCardProps {
  objectData: any;
  onBack: () => void;
}

export const ObjectDetailCard = ({ objectData, onBack }: ObjectDetailCardProps) => {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: requests } = useRequests();
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseDescription, setNewWarehouseDescription] = useState("");

  // Fetch warehouses for this object
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrgId, objectData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .eq("object_id", objectData.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Fetch responsible - could be a user or a participant
  const { data: responsibleProfile } = useQuery({
    queryKey: ["profile", objectData.responsible_user_id],
    queryFn: async () => {
      // Try profiles first
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", objectData.responsible_user_id)
        .maybeSingle();
      if (profile) return { name: profile.full_name || profile.email };
      // Try request_participants
      const { data: participant } = await supabase
        .from("request_participants")
        .select("name")
        .eq("id", objectData.responsible_user_id)
        .maybeSingle();
      if (participant) return { name: participant.name };
      return null;
    },
    enabled: !!objectData.responsible_user_id,
  });

  const objRequests = useMemo(() => {
    return requests?.filter((r) => r.object_id === objectData.id) || [];
  }, [requests, objectData.id]);

  const finances = useMemo(() => {
    const total = objRequests.reduce((sum, r) => sum + (r.amount || 0), 0);
    const paid = objRequests
      .filter((r) => r.payment_percentage && r.payment_percentage >= 100)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    return { total, paid, count: objRequests.length };
  }, [objRequests]);

  const deliveries = useMemo(() => {
    return objRequests.filter((r) => r.shipment_date || r.delivery_date);
  }, [objRequests]);

  const createWarehouse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouses").insert({
        organization_id: currentOrgId!,
        name: newWarehouseName,
        description: newWarehouseDescription || null,
        object_id: objectData.id,
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

  const STATUS_COLORS: Record<string, string> = {
    "Активный": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "Приостановлен": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    "Завершён": "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Назад к объектам
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">{objectData.name}</h2>
          {objectData.address && <p className="text-sm text-muted-foreground">{objectData.address}</p>}
        </div>
        <Badge className={STATUS_COLORS[objectData.status] || ""}>{objectData.status}</Badge>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="info" className="gap-1"><Info className="h-3.5 w-3.5" /> Информация</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1"><Warehouse className="h-3.5 w-3.5" /> Склады</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1"><FileText className="h-3.5 w-3.5" /> Заявки</TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-1"><Truck className="h-3.5 w-3.5" /> Поставки</TabsTrigger>
          <TabsTrigger value="finances" className="gap-1"><DollarSign className="h-3.5 w-3.5" /> Финансы</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Контракт:</span>
                  <p className="font-medium">{objectData.contract_number || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ответственный:</span>
                  <p className="font-medium">
                    {responsibleProfile?.name || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дата начала:</span>
                  <p className="font-medium">
                    {objectData.project_start_date ? format(new Date(objectData.project_start_date), "dd.MM.yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дата окончания:</span>
                  <p className="font-medium">
                    {objectData.project_end_date ? format(new Date(objectData.project_end_date), "dd.MM.yyyy") : "—"}
                  </p>
                </div>
              </div>
              {objectData.comment && (
                <div>
                  <span className="text-sm text-muted-foreground">Комментарий:</span>
                  <p className="text-sm mt-1">{objectData.comment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Склады объекта</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowWarehouseDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Добавить склад
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {warehouses.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Название</TableHead>
                        <TableHead className="text-xs">Описание</TableHead>
                        <TableHead className="text-xs w-[80px]">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="text-sm font-medium">{w.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{w.description || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteWarehouse.mutate(w.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Нет складов</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Заявки объекта ({objRequests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {objRequests.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Описание</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs">Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {objRequests.slice(0, 50).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm max-w-[300px] truncate">
                            <button
                              className="text-primary hover:underline text-left truncate"
                              onClick={() => navigate(`/requests/${r.id}`)}
                            >
                              {r.description}
                            </button>
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{r.status}</Badge></TableCell>
                          <TableCell className="text-sm">{r.amount ? `${r.amount.toLocaleString()} ₽` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Нет заявок</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Поставки ({deliveries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {deliveries.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Заявка</TableHead>
                        <TableHead className="text-xs">ТК</TableHead>
                        <TableHead className="text-xs">Дата отгрузки</TableHead>
                        <TableHead className="text-xs">Дата доставки</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm font-medium">{r.request_number}</TableCell>
                          <TableCell className="text-sm">{r.transport_company || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {r.shipment_date ? format(new Date(r.shipment_date), "dd.MM.yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.delivery_date ? format(new Date(r.delivery_date), "dd.MM.yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Нет поставок</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finances Tab */}
        <TabsContent value="finances">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">{finances.count}</p>
                  <p className="text-xs text-muted-foreground">Заявок</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">{finances.total.toLocaleString()} ₽</p>
                  <p className="text-xs text-muted-foreground">Общая сумма</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold">{finances.paid.toLocaleString()} ₽</p>
                  <p className="text-xs text-muted-foreground">Оплачено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый склад</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название склада</Label>
              <Input value={newWarehouseName} onChange={(e) => setNewWarehouseName(e.target.value)} placeholder="Основной склад" />
            </div>
            <div>
              <Label>Описание</Label>
              <Textarea value={newWarehouseDescription} onChange={(e) => setNewWarehouseDescription(e.target.value)} placeholder="Описание..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createWarehouse.mutate()} disabled={!newWarehouseName.trim() || createWarehouse.isPending}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
