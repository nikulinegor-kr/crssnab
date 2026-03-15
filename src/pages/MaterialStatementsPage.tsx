import { useState, useEffect, useMemo, useCallback } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronDown, FolderOpen, FileText, Upload, Sparkles,
  Download, Plus, Trash2, Pencil, File, Loader2, Calendar, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

// Types
interface MaterialStatement {
  id: string;
  organization_id: string;
  object_id: string | null;
  year: number;
  file_name: string;
  file_url: string;
  file_type: string;
  is_recognized: boolean;
  display_name: string | null;
  created_by: string | null;
  created_at: string;
}

interface MaterialItem {
  id: string;
  statement_id: string;
  organization_id: string;
  row_number: number;
  name: string;
  type_mark: string | null;
  unit: string | null;
  quantity: number | null;
  mass_per_unit: number | null;
}

interface MaterialObject {
  id: string;
  name: string;
  year: number;
  description: string | null;
  organization_id: string;
  created_at: string;
}

// Tree structure types
interface TreeNode {
  year: number;
  objects: { object: MaterialObject; statements: MaterialStatement[] }[];
}

export default function MaterialStatementsPage() {
  const { currentOrgId: orgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadYear, setUploadYear] = useState<number>(new Date().getFullYear());
  const [uploadObjectId, setUploadObjectId] = useState<string>("");
  const [recognizingId, setRecognizingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", type_mark: "", unit: "шт", quantity: "", mass_per_unit: "" });
  const [excelName, setExcelName] = useState("");
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [createObjectOpen, setCreateObjectOpen] = useState(false);
  const [newObjName, setNewObjName] = useState("");
  const [newObjYear, setNewObjYear] = useState<number>(new Date().getFullYear());
  const [newObjDesc, setNewObjDesc] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [bulkRecognizing, setBulkRecognizing] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editingStatementName, setEditingStatementName] = useState<string | null>(null);
  const [statementNameValue, setStatementNameValue] = useState("");

  // Fetch material objects (own structure)
  const { data: objects = [] } = useQuery({
    queryKey: ["material-objects", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase
        .from("material_objects" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("year", { ascending: false }) as any);
      return (data || []) as MaterialObject[];
    },
    enabled: !!orgId,
  });

  // Fetch statements
  const { data: statements = [] } = useQuery({
    queryKey: ["material-statements", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase
        .from("material_statements" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }) as any);
      return (data || []) as MaterialStatement[];
    },
    enabled: !!orgId,
  });

  // Fetch all items for the selected object's statements
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["material-items", selectedObjectId, selectedYear, orgId],
    queryFn: async () => {
      if (!orgId || !selectedObjectId || !selectedYear) return [];
      const stIds = statements
        .filter(s => s.object_id === selectedObjectId && s.year === selectedYear)
        .map(s => s.id);
      if (stIds.length === 0) return [];
      const { data } = await (supabase
        .from("material_statement_items" as any)
        .select("*")
        .in("statement_id", stIds)
        .order("row_number") as any);
      return (data || []) as MaterialItem[];
    },
    enabled: !!orgId && !!selectedObjectId && !!selectedYear,
  });

  // Items grouped by statement_id
  const itemsByStatement = useMemo(() => {
    const map = new Map<string, MaterialItem[]>();
    for (const item of allItems) {
      if (!map.has(item.statement_id)) map.set(item.statement_id, []);
      map.get(item.statement_id)!.push(item);
    }
    return map;
  }, [allItems]);

  // Build tree from material_objects (not from statements)
  const tree = useMemo((): TreeNode[] => {
    const yearMap = new Map<number, MaterialObject[]>();
    for (const obj of objects) {
      if (!yearMap.has(obj.year)) yearMap.set(obj.year, []);
      yearMap.get(obj.year)!.push(obj);
    }
    const result: TreeNode[] = [];
    const sortedYears = [...yearMap.keys()].sort((a, b) => b - a);
    for (const year of sortedYears) {
      const objs = yearMap.get(year)!;
      const objectEntries: TreeNode["objects"] = objs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(obj => ({
          object: obj,
          statements: statements.filter(s => s.object_id === obj.id),
        }));
      result.push({ year, objects: objectEntries });
    }
    return result;
  }, [objects, statements]);

  // Auto-expand current year
  useEffect(() => {
    const cy = new Date().getFullYear();
    setExpandedYears(prev => new Set([...prev, cy]));
  }, []);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const selectObject = (year: number, objectId: string) => {
    setSelectedYear(year);
    setSelectedObjectId(objectId);
    setSelectedStatementId(null);
  };

  // Create object
  const handleCreateObject = async () => {
    if (!orgId || !newObjName.trim()) return;
    await (supabase.from("material_objects" as any).insert({
      organization_id: orgId,
      name: newObjName.trim(),
      year: newObjYear,
      description: newObjDesc.trim() || null,
    }) as any);
    queryClient.invalidateQueries({ queryKey: ["material-objects"] });
    setCreateObjectOpen(false);
    setNewObjName("");
    setNewObjDesc("");
    toast({ title: "Объект создан" });
  };

  // Delete object
  const handleDeleteObject = async (objId: string) => {
    await (supabase.from("material_objects" as any).delete().eq("id", objId) as any);
    queryClient.invalidateQueries({ queryKey: ["material-objects"] });
    if (selectedObjectId === objId) {
      setSelectedObjectId(null);
      setSelectedYear(null);
    }
    toast({ title: "Объект удалён" });
  };

  const handleFileUpload = async (files: FileList) => {
    if (!orgId || !uploadObjectId) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
      const safeFileName = `${Date.now()}_file.${ext || 'pdf'}`;
      const path = `${orgId}/${uploadYear}/${uploadObjectId}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("material-statements")
        .upload(path, file);
      if (uploadError) {
        toast({ title: "Ошибка загрузки", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from("material_statements" as any)
        .insert({
          organization_id: orgId,
          object_id: uploadObjectId,
          year: uploadYear,
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType,
          is_recognized: fileType === "xlsx",
        });
      console.log("Insert result for", file.name, "object_id:", uploadObjectId, "error:", dbError);
      if (dbError) {
        toast({ title: "Ошибка записи", description: dbError.message, variant: "destructive" });
      }
    }
    toast({ title: "Файлы загружены" });
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    setUploadDialogOpen(false);
  };

  // Recognize PDF
  const handleRecognize = async (statement: MaterialStatement) => {
    if (!orgId) return;
    setRecognizingId(statement.id);
    try {
      const { data, error } = await supabase.functions.invoke("recognize-materials", {
        body: {
          fileUrl: statement.file_url,
          statementId: statement.id,
          organizationId: orgId,
        },
      });
      if (error) throw error;
      toast({ title: "Распознано", description: `Найдено ${data?.count || 0} материалов` });
      queryClient.invalidateQueries({ queryKey: ["material-statements"] });
      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      setSelectedStatementId(statement.id);
    } catch (e: any) {
      toast({ title: "Ошибка распознавания", description: e.message, variant: "destructive" });
    } finally {
      setRecognizingId(null);
    }
  };

  // Delete statement
  const handleDeleteStatement = async (id: string) => {
    await (supabase.from("material_statement_items" as any).delete().eq("statement_id", id) as any);
    await (supabase.from("material_statements" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    if (selectedStatementId === id) setSelectedStatementId(null);
    toast({ title: "Файл удалён" });
  };

  // Update item
  const handleUpdateItem = async (item: MaterialItem) => {
    await (supabase.from("material_statement_items" as any).update({
      name: item.name,
      type_mark: item.type_mark,
      unit: item.unit,
      quantity: item.quantity,
      mass_per_unit: item.mass_per_unit,
    }).eq("id", item.id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setEditingItem(null);
    toast({ title: "Обновлено" });
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    await (supabase.from("material_statement_items" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
  };

  // Add item to a specific statement
  const [addingToStatementId, setAddingToStatementId] = useState<string | null>(null);
  const handleAddItem = async () => {
    const targetStId = addingToStatementId || selectedStatementId;
    if (!orgId || !targetStId) return;
    const stItems = itemsByStatement.get(targetStId) || [];
    const maxRow = stItems.reduce((m, i) => Math.max(m, i.row_number), 0);
    await (supabase.from("material_statement_items" as any).insert({
      statement_id: targetStId,
      organization_id: orgId,
      row_number: maxRow + 1,
      name: newItem.name,
      type_mark: newItem.type_mark || null,
      unit: newItem.unit || null,
      quantity: newItem.quantity ? Number(newItem.quantity) : null,
      mass_per_unit: newItem.mass_per_unit ? Number(newItem.mass_per_unit) : null,
    }) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setAddingItem(false);
    setAddingToStatementId(null);
    setNewItem({ name: "", type_mark: "", unit: "шт", quantity: "", mass_per_unit: "" });
    toast({ title: "Материал добавлен" });
  };

  // Merged items across all statements (for export)
  const mergedItems = useMemo(() => {
    const map = new Map<string, MaterialItem>();
    for (const item of allItems) {
      const key = `${item.name.trim().toLowerCase()}|${(item.type_mark || "").trim().toLowerCase()}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.quantity = (existing.quantity || 0) + (item.quantity || 0);
      } else {
        map.set(key, { ...item });
      }
    }
    return [...map.values()].sort((a, b) => a.row_number - b.row_number);
  }, [allItems]);

  // Export Excel
  const handleExportExcel = () => {
    const data = mergedItems.map((m, i) => ({
      "№": i + 1,
      "Наименование и техническая характеристика": m.name,
      "Тип / марка / обозначение": m.type_mark || "",
      "Единица измерения": m.unit || "",
      "Количество": m.quantity ?? "",
      "Масса единицы (кг)": m.mass_per_unit ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = [5, 50, 30, 15, 12, 15];
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Материалы");
    const fileName = excelName.trim() || "Ведомость материалов";
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    setExcelDialogOpen(false);
    setExcelName("");
    toast({ title: "Excel скачан" });
  };

  // Save Excel to storage
  const handleSaveExcelToStorage = async () => {
    if (!orgId || !selectedObjectId || !selectedYear) return;
    const data = mergedItems.map((m, i) => ({
      "№": i + 1,
      "Наименование и техническая характеристика": m.name,
      "Тип / марка / обозначение": m.type_mark || "",
      "Единица измерения": m.unit || "",
      "Количество": m.quantity ?? "",
      "Масса единицы (кг)": m.mass_per_unit ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [5, 50, 30, 15, 12, 15].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Материалы");
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileName = `${excelName.trim() || "Итоговая ведомость"}.xlsx`;
    const path = `${orgId}/${selectedYear}/${selectedObjectId}/${Date.now()}_export.xlsx`;

    const { error } = await supabase.storage
      .from("material-statements")
      .upload(path, new Blob([wbOut]), { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
    await (supabase.from("material_statements" as any).insert({
      organization_id: orgId,
      object_id: selectedObjectId,
      year: selectedYear,
      file_name: fileName,
      file_url: urlData.publicUrl,
      file_type: "xlsx",
      is_recognized: true,
    }) as any);

    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    setExcelDialogOpen(false);
    setExcelName("");
    toast({ title: "Excel сохранён в папку объекта" });
  };

  const currentStatements = statements.filter(
    s => s.object_id === selectedObjectId && s.year === selectedYear
  );
  const selectedObj = objects.find(o => o.id === selectedObjectId);

  // Reset selection when object changes
  useEffect(() => {
    setSelectedFileIds(new Set());
  }, [selectedObjectId, selectedYear]);

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === currentStatements.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(currentStatements.map(s => s.id)));
    }
  };

  const handleBulkRecognize = async () => {
    if (!orgId || selectedFileIds.size === 0) return;
    const toRecognize = currentStatements.filter(
      s => selectedFileIds.has(s.id) && s.file_type === "pdf"
    );
    if (toRecognize.length === 0) {
      toast({ title: "Нет PDF файлов для распознавания", variant: "destructive" });
      return;
    }
    setBulkRecognizing(true);
    let successCount = 0;
    let errorCount = 0;
    for (const st of toRecognize) {
      try {
        // Reset recognition: delete old items first
        await (supabase.from("material_statement_items" as any).delete().eq("statement_id", st.id) as any);
        await (supabase.from("material_statements" as any).update({ is_recognized: false }).eq("id", st.id) as any);

        const { data, error } = await supabase.functions.invoke("recognize-materials", {
          body: { fileUrl: st.file_url, statementId: st.id, organizationId: orgId },
        });
        if (error) throw error;
        successCount++;
      } catch (e: any) {
        console.error("Bulk recognize error for", st.file_name, e);
        errorCount++;
      }
    }
    setBulkRecognizing(false);
    setSelectedFileIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    toast({
      title: `Распознано: ${successCount}`,
      description: errorCount > 0 ? `Ошибок: ${errorCount}` : undefined,
    });
  };

  // Bulk delete selected items
  const handleBulkDeleteItems = async () => {
    if (selectedItemIds.size === 0) return;
    for (const id of selectedItemIds) {
      await (supabase.from("material_statement_items" as any).delete().eq("id", id) as any);
    }
    setSelectedItemIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    toast({ title: `Удалено: ${selectedItemIds.size} материалов` });
  };

  // Rename statement section
  const handleRenameStatement = async (stId: string, name: string) => {
    await (supabase.from("material_statements" as any).update({ display_name: name.trim() || null }).eq("id", stId) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    setEditingStatementName(null);
    toast({ title: "Название обновлено" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left Tree */}
      <div className="w-72 border-r border-border bg-muted/30 overflow-y-auto flex-shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <h2 className="font-semibold text-sm">Ведомости материалов</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setCreateObjectOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Объект
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-3 w-3 mr-1" /> Файл
            </Button>
          </div>
        </div>
        <div className="p-2">
          {tree.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">Нет загруженных ведомостей</p>
          )}
          {tree.map(node => (
            <div key={node.year}>
              <button
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium hover:bg-accent/50 rounded-md"
                onClick={() => toggleYear(node.year)}
              >
                {expandedYears.has(node.year) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {node.year}
                <Badge variant="secondary" className="ml-auto text-xs">{node.objects.length}</Badge>
              </button>
              {expandedYears.has(node.year) && (
                <div className="ml-4">
                  {node.objects.map(entry => {
                    const isActive = selectedObjectId === entry.object.id && selectedYear === node.year;
                    return (
                      <button
                        key={entry.object.id}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors group ${
                          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50"
                        }`}
                        onClick={() => selectObject(node.year, entry.object.id)}
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1 text-left">{entry.object.name}</span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{entry.statements.length}</Badge>
                        <Trash2
                          className="h-3 w-3 text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                          onClick={e => { e.stopPropagation(); handleDeleteObject(entry.object.id); }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedObjectId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12" />
            <p>Выберите объект из дерева слева</p>
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Загрузить ведомость
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{selectedObj?.name || "Объект"}</h1>
                <p className="text-sm text-muted-foreground">{selectedYear} год</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-1" /> Добавить файлы
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        if (!e.target.files || !orgId || !selectedObjectId || !selectedYear) return;
                        for (const file of Array.from(e.target.files)) {
                          const ext = file.name.split(".").pop()?.toLowerCase();
                          const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
                          const safeFileName = `${Date.now()}_file.${ext || 'pdf'}`;
                          const path = `${orgId}/${selectedYear}/${selectedObjectId}/${safeFileName}`;
                          const { error: uploadError } = await supabase.storage.from("material-statements").upload(path, file);
                          if (uploadError) { toast({ title: "Ошибка", description: uploadError.message, variant: "destructive" }); continue; }
                          const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
                          const { error: dbErr } = await supabase
                            .from("material_statements" as any)
                            .insert({
                              organization_id: orgId,
                              object_id: selectedObjectId,
                              year: selectedYear,
                              file_name: file.name,
                              file_url: urlData.publicUrl,
                              file_type: fileType,
                              is_recognized: fileType === "xlsx",
                            });
                          console.log("Quick insert:", file.name, "object_id:", selectedObjectId, "error:", dbErr);
                          if (dbErr) { toast({ title: "Ошибка записи", description: dbErr.message, variant: "destructive" }); }
                        }
                        toast({ title: "Файлы добавлены" });
                        queryClient.invalidateQueries({ queryKey: ["material-statements"] });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                {mergedItems.length > 0 && (
                  <Button size="sm" onClick={() => setExcelDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-1" /> Скачать Excel
                  </Button>
                )}
              </div>
            </div>

            {/* Files */}
            <Card>
              <CardHeader className="py-3 flex-row items-center justify-between">
                <CardTitle className="text-sm">Файлы ({currentStatements.length})</CardTitle>
                {selectedFileIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Выбрано: {selectedFileIds.size}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRecognize}
                      disabled={bulkRecognizing}
                    >
                      {bulkRecognizing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Распознать заново
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={currentStatements.length > 0 && selectedFileIds.size === currentStatements.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Файл</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="w-[200px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStatements.map(st => (
                      <TableRow
                        key={st.id}
                        className={`cursor-pointer ${selectedStatementId === st.id ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedStatementId(st.id)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedFileIds.has(st.id)}
                            onCheckedChange={() => toggleFileSelection(st.id)}
                          />
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={st.file_url}
                            target="_blank"
                            rel="noopener"
                            className="text-primary hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {st.file_name}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.file_type === "pdf" ? "destructive" : "default"}>
                            {st.file_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {st.is_recognized ? (
                            <Badge variant="outline" className="text-green-600 border-green-300">Распознано</Badge>
                          ) : (
                            <Badge variant="secondary">Не распознано</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(st.created_at).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {st.file_type === "pdf" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecognize(st)}
                                disabled={recognizingId === st.id}
                              >
                                {recognizingId === st.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 mr-1" />
                                )}
                                Распознать
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteStatement(st.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {currentStatements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Нет загруженных файлов
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Materials Table */}
            {(selectedStatementId || (selectedObjectId && selectedYear)) && (
              <Card>
                <CardHeader className="py-3 flex-row items-center justify-between">
                  <CardTitle className="text-sm">
                    Материалы ({mergedItems.length})
                    {items.length !== mergedItems.length && (
                      <span className="text-muted-foreground font-normal ml-2">
                        (объединено из {items.length})
                      </span>
                    )}
                  </CardTitle>
                  {selectedStatementId && (
                    <Button size="sm" variant="outline" onClick={() => setAddingItem(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Добавить
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {itemsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">№</TableHead>
                          <TableHead>Наименование</TableHead>
                          <TableHead>Тип / марка</TableHead>
                          <TableHead className="w-20">Ед. изм.</TableHead>
                          <TableHead className="w-24">Кол-во</TableHead>
                          <TableHead className="w-24">Масса (кг)</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedItems.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  value={editingItem.name}
                                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                item.name
                              )}
                            </TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  value={editingItem.type_mark || ""}
                                  onChange={e => setEditingItem({ ...editingItem, type_mark: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                item.type_mark || "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  value={editingItem.unit || ""}
                                  onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                                  className="h-8 w-16"
                                />
                              ) : (
                                item.unit || "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  type="number"
                                  value={editingItem.quantity ?? ""}
                                  onChange={e => setEditingItem({ ...editingItem, quantity: e.target.value ? Number(e.target.value) : null })}
                                  className="h-8 w-20"
                                />
                              ) : (
                                item.quantity ?? "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  type="number"
                                  value={editingItem.mass_per_unit ?? ""}
                                  onChange={e => setEditingItem({ ...editingItem, mass_per_unit: e.target.value ? Number(e.target.value) : null })}
                                  className="h-8 w-20"
                                />
                              ) : (
                                item.mass_per_unit ?? "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {editingItem?.id === item.id ? (
                                  <Button size="sm" variant="ghost" onClick={() => handleUpdateItem(editingItem)}>
                                    ✓
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => setEditingItem({ ...item })}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Add row */}
                        {addingItem && (
                          <TableRow>
                            <TableCell>+</TableCell>
                            <TableCell>
                              <Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="h-8" placeholder="Наименование" />
                            </TableCell>
                            <TableCell>
                              <Input value={newItem.type_mark} onChange={e => setNewItem({ ...newItem, type_mark: e.target.value })} className="h-8" placeholder="Тип/марка" />
                            </TableCell>
                            <TableCell>
                              <Input value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} className="h-8 w-16" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} className="h-8 w-20" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" value={newItem.mass_per_unit} onChange={e => setNewItem({ ...newItem, mass_per_unit: e.target.value })} className="h-8 w-20" />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={handleAddItem} disabled={!newItem.name}>✓</Button>
                                <Button size="sm" variant="ghost" onClick={() => setAddingItem(false)}>✕</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {mergedItems.length === 0 && !addingItem && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Нет распознанных материалов
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить ведомость</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Год</label>
              <Select value={String(uploadYear)} onValueChange={v => setUploadYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Объект</label>
              <Select value={uploadObjectId} onValueChange={setUploadObjectId}>
                <SelectTrigger><SelectValue placeholder="Выберите объект" /></SelectTrigger>
                <SelectContent>
                  {objects.filter(o => o.year === uploadYear).map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                  {objects.filter(o => o.year === uploadYear).length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">Нет объектов за {uploadYear} год</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Файлы (PDF или Excel, до 10)</label>
              <Input
                type="file"
                accept=".pdf,.xlsx,.xls"
                multiple
                onChange={e => e.target.files && handleFileUpload(e.target.files)}
                disabled={!uploadObjectId}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel Export Dialog */}
      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Экспорт Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название файла</label>
              <Input
                value={excelName}
                onChange={e => setExcelName(e.target.value)}
                placeholder="Ведомость материалов"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-1" /> Скачать
            </Button>
            <Button onClick={handleSaveExcelToStorage}>
              <Upload className="h-4 w-4 mr-1" /> Сохранить в папку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Object Dialog */}
      <Dialog open={createObjectOpen} onOpenChange={setCreateObjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать объект</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название объекта</label>
              <Input value={newObjName} onChange={e => setNewObjName(e.target.value)} placeholder="Например: ТНВ ВЖК" />
            </div>
            <div>
              <label className="text-sm font-medium">Год</label>
              <Select value={String(newObjYear)} onValueChange={v => setNewObjYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Описание (необязательно)</label>
              <Input value={newObjDesc} onChange={e => setNewObjDesc(e.target.value)} placeholder="Описание объекта" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateObject} disabled={!newObjName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
