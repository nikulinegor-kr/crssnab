import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Truck, Pencil, Trash2 } from "lucide-react";

export default function EquipmentPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("brand")
        .order("model");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const filtered = search
    ? equipment.filter(
        (e: any) =>
          e.brand?.toLowerCase().includes(search.toLowerCase()) ||
          e.model?.toLowerCase().includes(search.toLowerCase())
      )
    : equipment;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("equipment")
          .update({ brand, model })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert({
          organization_id: currentOrgId!,
          brand,
          model,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      closeDialog();
      toast({ title: editingId ? "Техника обновлена" : "Техника добавлена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Техника удалена" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setBrand("");
    setModel("");
    setShowDialog(true);
  };

  const openEdit = (e: any) => {
    setEditingId(e.id);
    setBrand(e.brand);
    setModel(e.model);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  // Group by brand
  const brands = [...new Set(equipment.map((e: any) => e.brand))].sort();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Справочник техники</h1>
          <span className="text-muted-foreground text-sm">({equipment.length})</span>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Добавить технику
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по марке или модели..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Марка</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Нет техники
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.brand}</TableCell>
                  <TableCell>{e.model}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMutation.mutate(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать технику" : "Новая техника"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Марка</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="CAT, IVECO, TOYOTA..." />
            </div>
            <div>
              <Label>Модель</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="CAT 320, Daily..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!brand || !model || saveMutation.isPending}>
              {editingId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
