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
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function NomenclaturePage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [unit, setUnit] = useState("шт");

  const { data: products = [] } = useQuery({
    queryKey: ["warehouse-products", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_products")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const filtered = search
    ? products.filter(
        (p: any) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.article?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("warehouse_products")
          .update({ name, article: article || null, unit })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouse_products").insert({
          organization_id: currentOrgId!,
          name,
          article: article || null,
          unit,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      closeDialog();
      toast({ title: editingId ? "Товар обновлён" : "Товар создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouse_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-products"] });
      toast({ title: "Товар удалён" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setArticle("");
    setUnit("шт");
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setArticle(p.article || "");
    setUnit(p.unit || "шт");
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Номенклатура</h1>
          <span className="text-muted-foreground text-sm">({products.length})</span>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Добавить товар
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или артикулу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead>Ед. изм.</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Нет товаров
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.article || "—"}</TableCell>
                  <TableCell>{p.unit || "шт"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(p.created_at), "dd.MM.yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMutation.mutate(p.id)}
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
            <DialogTitle>{editingId ? "Редактировать товар" : "Новый товар"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название товара" />
            </div>
            <div>
              <Label>Артикул</Label>
              <Input value={article} onChange={(e) => setArticle(e.target.value)} placeholder="ART-001" />
            </div>
            <div>
              <Label>Единица измерения</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="шт" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
              {editingId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
