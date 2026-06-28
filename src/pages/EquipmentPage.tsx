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
import { useNavigate } from "react-router-dom";
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Справочник техники</h1>
          <span className="text-muted-foreground text-sm">({equipment.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-1" />
            {importing ? "Импорт..." : "Импорт Excel"}
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Добавить технику
          </Button>
        </div>
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

      {uniqueBrands.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={brandFilter === null ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setBrandFilter(null)}
          >
            Все ({equipment.length})
          </Button>
          {uniqueBrands.map(([brandName, count]) => (
              <Button
                key={brandName}
                variant={brandFilter === brandName ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBrandFilter(brandFilter === brandName ? null : brandName)}
              >
                {brandName} ({count})
              </Button>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">Выбрано: {selectedIds.size}</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkDeleting}
            onClick={async () => {
              setBulkDeleting(true);
              try {
                const ids = Array.from(selectedIds);
                const { error } = await supabase.from("equipment").delete().in("id", ids);
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ["equipment"] });
                setSelectedIds(new Set());
                toast({ title: `Удалено: ${ids.length}` });
              } catch {
                toast({ title: "Ошибка удаления", variant: "destructive" });
              } finally {
                setBulkDeleting(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {bulkDeleting ? "Удаление..." : "Удалить выбранные"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Снять выделение
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(filtered.map((e: any) => e.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>Марка / Модель</TableHead>
              <TableHead>Гос номер</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Год</TableHead>
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
                <TableRow key={e.id} className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(e.id) ? "bg-muted/50" : ""}`} onClick={() => navigate(`/equipment/${e.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(e.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(e.id); else next.delete(e.id);
                        setSelectedIds(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{[e.brand, e.model].filter(Boolean).join(" ")}</TableCell>
                  <TableCell>
                    {e.plate_number ? (
                      <Badge variant="outline">{e.plate_number}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.vin || "—"}</TableCell>
                  <TableCell>{e.year || "—"}</TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <CopyString equipment={e} />
                  </TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/equipment/${e.id}`)} title="Аналитика техники">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
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
                    <TableHead>Номер</TableHead>
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
                      <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
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
    </div>
  );
}
