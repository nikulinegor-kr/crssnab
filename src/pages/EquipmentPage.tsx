import { warehouseRows } from "@/lib/simpleWarehouse";
import type { Tables } from "@/integrations/supabase/types";
import { EquipmentWorkspace } from "@/components/workspace/EquipmentWorkspace";
import { useState, useRef, useMemo } from "react";
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
import { Plus, Search, Truck, Pencil, Trash2, Copy, Check, Upload, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
export default function EquipmentPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [comment, setComment] = useState("");
  const [currentObjectId, setCurrentObjectId] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [historyEquipmentId, setHistoryEquipmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: linkedRequests = [] } = useQuery({
    queryKey: ["equipment-requests", historyEquipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_number, description, status, priority, created_at, request_type")
        .eq("equipment_id", historyEquipmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyEquipmentId,
  });

  const { data: equipment = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["equipment", currentOrgId],
    queryFn: async () => {
      return warehouseRows<Tables<'equipment'>>((from,to)=>supabase.from('equipment').select('*').eq('organization_id',currentOrgId!).order('brand').order('model').order('id').range(from,to));
    },
    enabled: !!currentOrgId,
  });

  const { data: objects = [] } = useQuery({
    queryKey: ["equipment-objects", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });

  // Normalize brand: trim, remove trailing punctuation, uppercase
  const normalizeBrand = (brand: string | null | undefined): string => {
    if (!brand) return "";
    return brand.trim().replace(/[,.\s]+$/, "").toUpperCase();
  };

  // Extract unique normalized brands for quick filters
  const uniqueBrands = useMemo(() => {
    const brandCounts = new Map<string, number>();
    equipment.forEach((e: any) => {
      const b = normalizeBrand(e.brand);
      if (b) brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
    });
    return Array.from(brandCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  const filtered = useMemo(() => {
    let result = equipment;
    
    // Apply brand filter (normalized comparison)
    if (brandFilter) {
      result = result.filter((e: any) => normalizeBrand(e.brand) === brandFilter);
    }
    
    // Apply search filter (multi-word)
    if (search) {
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((e: any) => {
        const haystack = `${e.brand || ""} ${e.model || ""} ${e.vin || ""} ${e.plate_number || ""}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }
    
    return result;
  }, [equipment, brandFilter, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        brand,
        model,
        vin: vin || null,
        year: year ? parseInt(year) : null,
        plate_number: plateNumber || null,
        comment: comment || null,
        current_object_id: currentObjectId,
        responsible_name: responsibleName || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("equipment")
          .update(payload)
          .eq("id", editingId).eq("organization_id", currentOrgId!);
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
      const { error } = await supabase.from("equipment").delete().eq("id", id).eq("organization_id", currentOrgId!);
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
    setCurrentObjectId(null); setResponsibleName("");
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
    setCurrentObjectId(e.current_object_id ?? null);
    setResponsibleName(e.responsible_name || "");
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrgId) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Skip header if first row looks like headers
      const startIdx = rows.length > 0 && typeof rows[0][0] === "string" &&
        ["марка", "brand"].includes(rows[0][0].toLowerCase().trim()) ? 1 : 0;

      const existingSet = new Set(
        equipment.map((eq: any) => `${(eq.brand || "").toLowerCase().trim()}|${(eq.model || "").toLowerCase().trim()}`)
      );
      const existingVins = new Set(
        equipment.filter((eq: any) => eq.vin).map((eq: any) => eq.vin!.toLowerCase().trim())
      );

      const toInsert: any[] = [];
      let skipped = 0;

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;

        const rawName = String(row[0] || "").trim();
        const spaceIdx = rawName.indexOf(" ");
        const rBrand = spaceIdx > 0 ? rawName.substring(0, spaceIdx).trim() : rawName;
        const rModel = spaceIdx > 0 ? rawName.substring(spaceIdx + 1).trim() : "";
        const rPlate = String(row[1] || "").trim() || null;
        const rVin = String(row[2] || "").trim().toUpperCase() || null;
        const rYear = row[3] ? parseInt(String(row[3])) : null;
        const rComment = String(row[4] || "").trim() || null;

        if (!rBrand) { skipped++; continue; }

        // Check duplicate brand+model
        const key = `${rBrand.toLowerCase()}|${rModel.toLowerCase()}`;
        if (existingSet.has(key)) { skipped++; continue; }

        // Check duplicate VIN
        if (rVin && existingVins.has(rVin.toLowerCase())) { skipped++; continue; }

        // Avoid duplicates within the import file itself
        if (existingSet.has(key)) { skipped++; continue; }
        existingSet.add(key);
        if (rVin) {
          if (existingVins.has(rVin.toLowerCase())) { skipped++; continue; }
          existingVins.add(rVin.toLowerCase());
        }

        toInsert.push({
          organization_id: currentOrgId,
          brand: rBrand,
          model: rModel,
          vin: rVin,
          year: rYear && !isNaN(rYear) ? rYear : null,
          plate_number: rPlate,
          comment: rComment,
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("equipment").insert(toInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({
        title: `Импорт завершён`,
        description: `Добавлено: ${toInsert.length}, пропущено: ${skipped}`,
      });
    } catch (err: any) {
      toast({ title: "Ошибка импорта", description: err?.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return <>
    <EquipmentWorkspace key={currentOrgId} equipment={filtered} objects={objects} orgId={currentOrgId} loading={isLoading} error={isError} retry={() => void refetch()} search={search} onSearch={setSearch} onCreate={openCreate} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} selectedIds={selectedIds} onSelect={(id,value)=>setSelectedIds(previous=>{const next=new Set(previous);if(value)next.add(id);else next.delete(id);return next;})} tools={<>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel}/><Button variant="outline" onClick={()=>fileInputRef.current?.click()} disabled={importing}><Upload size={16}/>{importing?'Импорт…':'Импорт Excel'}</Button>
      {selectedIds.size > 0 && <><span className="text-sm">Выбрано: {selectedIds.size}</span><Button variant="outline" onClick={()=>setSelectedIds(new Set())}>Снять выделение</Button><Button variant="destructive" disabled={bulkDeleting} onClick={async()=>{if(!window.confirm(`Удалить выбранную технику (${selectedIds.size})?`))return;setBulkDeleting(true);try{const {error}=await supabase.from('equipment').delete().eq('organization_id',currentOrgId).in('id',Array.from(selectedIds));if(error)throw error;queryClient.invalidateQueries({queryKey:['equipment']});setSelectedIds(new Set());toast({title:'Техника удалена'});}catch{toast({title:'Не удалось удалить технику',variant:'destructive'});}finally{setBulkDeleting(false);}}}>Удалить выбранные</Button></>}
    </>} />
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="cw-modal" onOpenAutoFocus={e=>e.preventDefault()}>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Текущий объект</Label>
                <Select value={currentObjectId ?? "__none__"} onValueChange={(v) => setCurrentObjectId(v === "__none__" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Не привязан" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Не привязан —</SelectItem>
                    {objects.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ответственный (ФИО)</Label>
                <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Иванов И.И." />
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

      {/* Equipment Request History Dialog */}
      <Dialog open={!!historyEquipmentId} onOpenChange={(open) => !open && setHistoryEquipmentId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>История заявок по технике</DialogTitle>
          </DialogHeader>
          {linkedRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет связанных заявок</p>
          ) : (
            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>

                    <TableHead>Описание</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedRequests.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/requests/${r.id}`)}
                    >

                      <TableCell className="max-w-[250px] truncate">{r.description}</TableCell>
                      <TableCell><Badge variant="outline">{r.request_type || "—"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
  </>;
}
