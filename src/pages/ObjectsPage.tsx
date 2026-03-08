import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequests } from "@/hooks/useRequests";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building2, Plus, Archive, Pencil, Trash2 } from "lucide-react";
import { ObjectFormDialog } from "@/components/objects/ObjectFormDialog";
import { ObjectDetailCard } from "@/components/objects/ObjectDetailCard";
import { DeleteObjectDialog } from "@/components/objects/DeleteObjectDialog";

const STATUS_COLORS: Record<string, string> = {
  "Активный": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Приостановлен": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Завершён": "bg-muted text-muted-foreground",
};

const ObjectsPage = () => {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: requests } = useRequests();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingObject, setEditingObject] = useState<any>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [tab, setTab] = useState("active");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ["request-objects-all", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      const archived = formData.status === "Завершён";
      const { error } = await supabase.from("request_objects").insert({
        organization_id: currentOrgId!,
        name: formData.name,
        address: formData.address || null,
        responsible_user_id: formData.responsible_user_id || null,
        contract_number: formData.contract_number || null,
        project_start_date: formData.project_start_date || null,
        project_end_date: formData.project_end_date || null,
        status: formData.status,
        comment: formData.comment || null,
        warehouse_id: formData.warehouse_id || null,
        archived,
        is_active: !archived,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      queryClient.invalidateQueries({ queryKey: ["request-objects-all"] });
      setShowForm(false);
      toast({ title: "Объект создан" });
    },
    onError: () => toast({ title: "Ошибка создания", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const archived = formData.status === "Завершён";
      const { error } = await supabase
        .from("request_objects")
        .update({
          name: formData.name,
          address: formData.address || null,
          responsible_user_id: formData.responsible_user_id || null,
          contract_number: formData.contract_number || null,
          project_start_date: formData.project_start_date || null,
          project_end_date: formData.project_end_date || null,
          status: formData.status,
          comment: formData.comment || null,
          warehouse_id: formData.warehouse_id || null,
          archived,
          is_active: !archived,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      queryClient.invalidateQueries({ queryKey: ["request-objects-all"] });
      setEditingObject(null);
      toast({ title: "Объект обновлён" });
    },
    onError: () => toast({ title: "Ошибка обновления", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("request_objects")
        .update({ archived: true, is_active: false, status: "Завершён" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      queryClient.invalidateQueries({ queryKey: ["request-objects-all"] });
      toast({ title: "Объект перенесён в архив" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const filteredObjects = useMemo(() => {
    const isArchive = tab === "archive";
    return objects
      .filter((o: any) => {
        const matchesTab = isArchive ? o.archived === true : o.archived !== true;
        const matchesSearch = !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.address?.toLowerCase().includes(search.toLowerCase());
        return matchesTab && matchesSearch;
      });
  }, [objects, tab, search]);

  const selectedObject = selectedObjectId ? objects.find((o: any) => o.id === selectedObjectId) : null;

  if (selectedObject) {
    return (
      <div className="w-full p-2 sm:p-4 md:p-6">
        <ObjectDetailCard
          objectData={selectedObject}
          onBack={() => setSelectedObjectId(null)}
          onEdit={(obj) => { setSelectedObjectId(null); setEditingObject(obj); }}
          onArchive={(id) => { setSelectedObjectId(null); archiveMutation.mutate(id); }}
          onDelete={(obj) => { setSelectedObjectId(null); setDeleteTarget(obj); }}
        />
      </div>
    );
  }

  return (
    <div className="w-full p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Объекты</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{filteredObjects.length} объектов</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Новый объект
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск объекта..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Активные</TabsTrigger>
          <TabsTrigger value="archive" className="gap-1">
            <Archive className="h-3.5 w-3.5" /> Архив
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-48 mb-2" /><Skeleton className="h-4 w-32" /></CardContent></Card>
              ))
            ) : filteredObjects.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {tab === "archive" ? "Архив пуст" : "Объекты не найдены"}
                </CardContent>
              </Card>
            ) : (
              filteredObjects.map((obj: any) => {
                const objRequests = requests?.filter((r) => r.object_id === obj.id) || [];
                return (
                  <Card key={obj.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedObjectId(obj.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm sm:text-base truncate">{obj.name}</h3>
                            <Badge className={`text-xs ${STATUS_COLORS[obj.status] || ""}`}>{obj.status}</Badge>
                          </div>
                          {obj.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{obj.address}</p>}
                          {obj.contract_number && <p className="text-xs text-muted-foreground">Контракт: {obj.contract_number}</p>}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className="text-xs">{objRequests.length} заявок</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingObject(obj)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {tab === "active" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archiveMutation.mutate(obj.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(obj)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <ObjectFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        currentOrgId={currentOrgId}
      />

      {/* Edit Dialog */}
      <ObjectFormDialog
        open={!!editingObject}
        onOpenChange={(open) => { if (!open) setEditingObject(null); }}
        onSubmit={(data) => updateMutation.mutate({ id: editingObject.id, formData: data })}
        isPending={updateMutation.isPending}
        initialData={editingObject}
        title="Редактирование объекта"
        currentOrgId={currentOrgId}
      />

      {/* Delete Dialog */}
      {deleteTarget && (
        <DeleteObjectDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          objectId={deleteTarget.id}
          objectName={deleteTarget.name}
          requestCount={requests?.filter((r) => r.object_id === deleteTarget.id).length || 0}
          availableObjects={objects.filter((o: any) => o.id !== deleteTarget.id).map((o: any) => ({ id: o.id, name: o.name }))}
          onSuccess={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default ObjectsPage;
