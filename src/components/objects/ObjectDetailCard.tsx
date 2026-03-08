import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Warehouse, FileText, Truck, DollarSign, Info, Pencil, Archive, Upload, Download, Eye, FolderOpen } from "lucide-react";
import { format } from "date-fns";

interface ObjectDetailCardProps {
  objectData: any;
  onBack: () => void;
  onEdit?: (obj: any) => void;
  onArchive?: (id: string) => void;
  onDelete?: (obj: any) => void;
}

const DOC_TYPES = ["Контракт", "Договор", "Счёт", "КП", "Фото", "Другое"];

export const ObjectDetailCard = ({ objectData, onBack, onEdit, onArchive, onDelete }: ObjectDetailCardProps) => {
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Load ALL requests for this object directly (no 1000 row limit)
  const { data: objRequests = [] } = useQuery({
    queryKey: ["object-requests", objectData.id],
    queryFn: async () => {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("requests")
          .select("id, request_number, description, status, priority, amount, payment_percentage, shipment_date, delivery_date, transport_company, object_id")
          .eq("object_id", objectData.id)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    },
    enabled: !!objectData.id,
  });
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseDescription, setNewWarehouseDescription] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("Другое");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch object documents
  const { data: documents = [] } = useQuery({
    queryKey: ["object-documents", objectData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("object_documents")
        .select("*")
        .eq("object_id", objectData.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch responsible - could be a user or a participant
  const { data: responsibleProfile } = useQuery({
    queryKey: ["profile", objectData.responsible_user_id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", objectData.responsible_user_id)
        .maybeSingle();
      if (profile) return { name: profile.full_name || profile.email };
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

  const deleteDocument = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("object_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["object-documents"] });
      toast({ title: "Документ удалён" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentOrgId) return;

    setIsUploadingDoc(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const file of Array.from(files)) {
        const sanitized = file.name.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9.-]/g, '_') || `file_${Date.now()}`;
        const fileName = `${objectData.id}-${Date.now()}-${sanitized}`;

        const { error: uploadError } = await supabase.storage
          .from("object-documents")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("object-documents")
          .getPublicUrl(fileName);

        await supabase.from("object_documents").insert({
          object_id: objectData.id,
          organization_id: currentOrgId,
          doc_type: uploadDocType,
          name: file.name,
          file_url: publicUrl,
          created_by: user?.id || null,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["object-documents"] });
      toast({ title: "Документ загружен" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    "Активный": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "Приостановлен": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    "Завершён": "bg-muted text-muted-foreground",
  };

  const DOC_TYPE_COLORS: Record<string, string> = {
    "Контракт": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "Договор": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "Счёт": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "КП": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Фото": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
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
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[objectData.status] || ""}>{objectData.status}</Badge>
          {onEdit && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => onEdit(objectData)}>
              <Pencil className="h-3.5 w-3.5" /> Редактировать
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowWarehouseDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Склад
          </Button>
          {onArchive && objectData.status !== "Завершён" && (
            <Button variant="outline" size="sm" className="gap-1 text-muted-foreground hover:text-destructive" onClick={() => onArchive(objectData.id)}>
              <Archive className="h-3.5 w-3.5" /> В архив
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => onDelete(objectData)}>
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="info" className="gap-1"><Info className="h-3.5 w-3.5" /> Информация</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1"><Warehouse className="h-3.5 w-3.5" /> Склады</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1"><FileText className="h-3.5 w-3.5" /> Заявки</TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-1"><Truck className="h-3.5 w-3.5" /> Поставки</TabsTrigger>
          <TabsTrigger value="finances" className="gap-1"><DollarSign className="h-3.5 w-3.5" /> Финансы</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1"><FolderOpen className="h-3.5 w-3.5" /> Документы</TabsTrigger>
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
                  <p className="font-medium">{responsibleProfile?.name || "—"}</p>
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
                <div className="flex gap-2">
                  {warehouses.length > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/warehouse?object=${objectData.id}`)}>
                      <Warehouse className="h-3 w-3 mr-1" /> Открыть склад
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowWarehouseDialog(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Добавить склад
                  </Button>
                </div>
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
                            <button className="text-primary hover:underline text-left truncate" onClick={() => navigate(`/requests/${r.id}`)}>
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
                          <TableCell className="text-sm">
                            <button className="text-primary hover:underline text-left truncate max-w-[200px] block" onClick={() => navigate(`/requests/${r.id}`)}>
                              {r.description || "—"}
                            </button>
                          </TableCell>
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

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Документы объекта ({documents.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={isUploadingDoc} asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      {isUploadingDoc ? "Загрузка..." : "Загрузить"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleDocumentUpload}
                        className="hidden"
                        disabled={isUploadingDoc}
                      />
                    </label>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-[10px] px-1.5 py-0 ${DOC_TYPE_COLORS[doc.doc_type] || "bg-muted text-muted-foreground"}`}>
                            {doc.doc_type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(doc.created_at), "dd.MM.yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3 mr-1" /> Открыть
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                          <a href={doc.file_url} download>
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteDocument.mutate(doc.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Нет документов</p>
                  <p className="text-xs text-muted-foreground mt-1">Загрузите контракты, счета и другие файлы объекта</p>
                </div>
              )}
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
