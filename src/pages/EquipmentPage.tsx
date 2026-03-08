import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Truck, Pencil, Trash2, Copy, Check, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
function CopyString({ equipment }: { equipment: any }) {
  const [copied, setCopied] = useState(false);
  const parts = [
    [equipment.brand, equipment.model].filter(Boolean).join(" "),
    equipment.year,
    equipment.vin ? `VIN ${equipment.vin}` : null,
  ].filter(Boolean);
  const text = parts.join(" • ");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
      <span className="truncate">{text}</span>
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export default function EquipmentPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [comment, setComment] = useState("");

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
          e.model?.toLowerCase().includes(search.toLowerCase()) ||
          e.vin?.toLowerCase().includes(search.toLowerCase()) ||
          e.plate_number?.toLowerCase().includes(search.toLowerCase())
      )
    : equipment;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        brand,
        model,
        vin: vin || null,
        year: year ? parseInt(year) : null,
        plate_number: plateNumber || null,
        comment: comment || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("equipment")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert({
          organization_id: currentOrgId!,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      closeDialog();
      toast({ title: editingId ? "Техника обновлена" : "Техника добавлена" });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("equipment_vin_unique")
        ? "Техника с таким VIN уже существует"
        : "Ошибка сохранения";
      toast({ title: msg, variant: "destructive" });
    },
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
    setBrand(""); setModel(""); setVin(""); setYear(""); setPlateNumber(""); setComment("");
    setShowDialog(true);
  };

  const openEdit = (e: any) => {
    setEditingId(e.id);
    setBrand(e.brand || "");
    setModel(e.model || "");
    setVin(e.vin || "");
    setYear(e.year?.toString() || "");
    setPlateNumber(e.plate_number || "");
    setComment(e.comment || "");
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
          placeholder="Поиск по марке, модели, VIN, гос номеру..."
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
              <TableHead>VIN</TableHead>
              <TableHead>Год</TableHead>
              <TableHead>Гос номер</TableHead>
              <TableHead>Копирование</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Нет техники
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.brand}</TableCell>
                  <TableCell>{e.model}</TableCell>
                  <TableCell className="font-mono text-xs">{e.vin || "—"}</TableCell>
                  <TableCell>{e.year || "—"}</TableCell>
                  <TableCell>
                    {e.plate_number ? (
                      <Badge variant="outline">{e.plate_number}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <CopyString equipment={e} />
                  </TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать технику" : "Новая техника"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Марка *</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="CAT, IVECO..." />
              </div>
              <div>
                <Label>Модель *</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="CAT 320, Daily..." />
              </div>
            </div>
            <div>
              <Label>VIN</Label>
              <Input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="Уникальный VIN номер" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Год выпуска</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2019" min="1900" max="2100" />
              </div>
              <div>
                <Label>Гос номер</Label>
                <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="А123БВ777" />
              </div>
            </div>
            <div>
              <Label>Комментарий</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Заметки..." rows={2} />
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
