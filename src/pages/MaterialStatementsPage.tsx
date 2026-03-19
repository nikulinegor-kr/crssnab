import { useState, useEffect, useMemo, useCallback, type DragEvent } from "react";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronDown, FolderOpen, FileText, Upload, Sparkles,
  Download, Plus, Trash2, Pencil, File, Loader2, Calendar, RefreshCw,
  FolderPlus, MoveRight, GripVertical, FileSpreadsheet, FileArchive,
  Wrench, Archive, Layers, ShoppingCart, Check,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import { CreateProcurementDialog } from "@/components/materials/CreateProcurementDialog";
import { ConsolidatedExcelExportButton } from "@/components/materials/ConsolidatedExcelExportButton";
import { IncomingUploads } from "@/components/materials/IncomingUploads";
import { FinalStatement } from "@/components/materials/FinalStatement";

// Types
interface MaterialStatement {
  id: string;
  organization_id: string;
  object_id: string | null;
  folder_id: string | null;
  section_id: string | null;
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
  price: number | null;
  total_price: number | null;
  supplier: string | null;
  procurement_request_id: string | null;
  procurement_status: string;
}

interface MaterialObject {
  id: string;
  name: string;
  year: number;
  description: string | null;
  organization_id: string;
  created_at: string;
}

interface MaterialSection {
  id: string;
  object_id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface MaterialFolder {
  id: string;
  section_id: string | null;
  object_id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  type: 'general_docs' | 'materials';
  created_at: string;
}

interface KpItem { name: string; unit: string | null; price: number | null; }
interface KpMatch { kpItem: KpItem; matchedItemId: string | null; matchedItemName: string | null; oldPrice: number | null; similarity: number; autoMatched: boolean; status: "updated" | "not_found"; }
interface KpApplyLog { materialName: string; oldPrice: number | null; newPrice: number | null; status: "updated" | "not_found"; fileName?: string; }

// Fuzzy matching utility
function levenshtein(a: string, b: string): number {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= bn; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[an][bn];
}

function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.includes(lb) || lb.includes(la)) return 0.85;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(la, lb) / maxLen;
}

function findBestMatch(kpName: string, kpUnit: string | null, projectItems: MaterialItem[]): { item: MaterialItem | null; score: number } {
  let bestItem: MaterialItem | null = null;
  let bestScore = 0;
  const kpWords = kpName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const normalizedKpUnit = (kpUnit || "").toLowerCase().trim();
  for (const item of projectItems) {
    let score = similarity(kpName, item.name);
    const itemWords = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const commonWords = kpWords.filter(w => itemWords.some(iw => iw.includes(w) || w.includes(iw)));
    const wordOverlap = kpWords.length > 0 ? commonWords.length / kpWords.length : 0;
    score = Math.max(score, wordOverlap * 0.9);
    // Boost score if units match
    if (normalizedKpUnit && item.unit) {
      const normalizedItemUnit = item.unit.toLowerCase().trim();
      if (normalizedKpUnit === normalizedItemUnit) score = Math.min(1, score + 0.05);
      else if (score > 0.5) score -= 0.05;
    }
    if (score > bestScore) { bestScore = score; bestItem = item; }
  }
  return { item: bestItem, score: bestScore };
}

export default function MaterialStatementsPage() {
  const { currentOrgId: orgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selection state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIncomingObjectId, setSelectedIncomingObjectId] = useState<string | null>(null);
  const [selectedFinalObjectId, setSelectedFinalObjectId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Dialog state
  const [createObjectOpen, setCreateObjectOpen] = useState(false);
  const [newObjName, setNewObjName] = useState("");
  const [newObjYear, setNewObjYear] = useState<number>(new Date().getFullYear());
  const [newObjDesc, setNewObjDesc] = useState("");
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionObjectId, setNewSectionObjectId] = useState<string>("");
  const [renameSectionDialog, setRenameSectionDialog] = useState<MaterialSection | null>(null);
  const [renameSectionValue, setRenameSectionValue] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderSectionId, setNewFolderSectionId] = useState<string>("");
  const [newFolderObjectId, setNewFolderObjectId] = useState<string>("");
  const [newFolderType, setNewFolderType] = useState<string>("materials");
  const [moveFileDialog, setMoveFileDialog] = useState<MaterialStatement | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>("");
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveTargetFolderId, setBulkMoveTargetFolderId] = useState<string>("");
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelName, setExcelName] = useState("");

  // Item editing state
  const [recognizingId, setRecognizingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingToStatementId, setAddingToStatementId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", type_mark: "", unit: "шт", quantity: "", mass_per_unit: "", price: "" });
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [bulkRecognizing, setBulkRecognizing] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editingStatementName, setEditingStatementName] = useState<string | null>(null);
  const [statementNameValue, setStatementNameValue] = useState("");

  // KP state
  const [kpDialogOpen, setKpDialogOpen] = useState(false);
  const [kpLoading, setKpLoading] = useState(false);
  const [kpMatches, setKpMatches] = useState<KpMatch[]>([]);
  const [kpSupplier, setKpSupplier] = useState<string | null>(null);
  const [kpApplying, setKpApplying] = useState(false);

  // ZIP download state
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [procurementDialogOpen, setProcurementDialogOpen] = useState(false);
  const [procurementMode, setProcurementMode] = useState<"selected" | "all">("all");

  // Queries
  const { data: objects = [] } = useQuery({
    queryKey: ["material-objects", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase
        .from("material_objects" as any).select("*")
        .eq("organization_id", orgId).order("year", { ascending: false }) as any);
      return (data || []) as MaterialObject[];
    },
    enabled: !!orgId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["material-sections", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase
        .from("material_sections" as any).select("*")
        .eq("organization_id", orgId).order("sort_order").order("name") as any);
      return (data || []) as MaterialSection[];
    },
    enabled: !!orgId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["material-folders", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase
        .from("material_folders" as any).select("*")
        .eq("organization_id", orgId).order("sort_order").order("name") as any);
      return (data || []) as MaterialFolder[];
    },
    enabled: !!orgId,
  });

  const { data: statements = [] } = useQuery({
    queryKey: ["material-statements", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const PAGE_SIZE = 1000;
      let all: MaterialStatement[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statements" as any).select("*")
          .eq("organization_id", orgId).order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = (data || []) as MaterialStatement[];
        all = all.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: !!orgId,
  });

  // Items for current folder's statements
  const currentStatements = useMemo(() =>
    statements.filter(s => s.folder_id === selectedFolderId),
    [statements, selectedFolderId]
  );

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["material-items", selectedFolderId, orgId],
    queryFn: async () => {
      if (!orgId || !selectedFolderId) return [];
      const stIds = currentStatements.map(s => s.id);
      if (stIds.length === 0) return [];
      const PAGE_SIZE = 1000;
      let all: MaterialItem[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statement_items" as any).select("*")
          .in("statement_id", stIds).order("row_number")
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = (data || []) as MaterialItem[];
        all = all.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: !!orgId && !!selectedFolderId && currentStatements.length > 0,
  });

  const itemsByStatement = useMemo(() => {
    const map = new Map<string, MaterialItem[]>();
    for (const item of allItems) {
      if (!map.has(item.statement_id)) map.set(item.statement_id, []);
      map.get(item.statement_id)!.push(item);
    }
    return map;
  }, [allItems]);

  // Build tree: Year → Objects → Sections → Folders
  const tree = useMemo(() => {
    const yearMap = new Map<number, MaterialObject[]>();
    for (const obj of objects) {
      if (!yearMap.has(obj.year)) yearMap.set(obj.year, []);
      yearMap.get(obj.year)!.push(obj);
    }
    return [...yearMap.keys()].sort((a, b) => b - a).map(year => ({
      year,
      objects: yearMap.get(year)!.sort((a, b) => a.name.localeCompare(b.name)).map(obj => ({
        object: obj,
        sections: sections.filter(s => s.object_id === obj.id).sort((a, b) => a.sort_order - b.sort_order).map(sec => ({
          section: sec,
          folders: folders.filter(f => f.section_id === sec.id).sort((a, b) => a.sort_order - b.sort_order),
        })),
      })),
    }));
  }, [objects, sections, folders]);

  // Auto-expand current year
  useEffect(() => {
    setExpandedYears(prev => new Set([...prev, new Date().getFullYear()]));
  }, []);

  const toggleYear = (year: number) => setExpandedYears(prev => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n; });
  const toggleObject = (objId: string) => setExpandedObjects(prev => { const n = new Set(prev); n.has(objId) ? n.delete(objId) : n.add(objId); return n; });
  const toggleSection = (secId: string) => setExpandedSections(prev => { const n = new Set(prev); n.has(secId) ? n.delete(secId) : n.add(secId); return n; });

  const selectFolder = (year: number, objectId: string, sectionId: string, folderId: string) => {
    setSelectedYear(year);
    setSelectedObjectId(objectId);
    setSelectedSectionId(sectionId);
    setSelectedFolderId(folderId);
    setSelectedIncomingObjectId(null);
    setSelectedFinalObjectId(null);
    setSelectedStatementId(null);
    setSelectedFileIds(new Set());
    setSelectedItemIds(new Set());
  };

  const selectIncoming = (year: number, objectId: string) => {
    setSelectedYear(year);
    setSelectedObjectId(objectId);
    setSelectedSectionId(null);
    setSelectedFolderId(null);
    setSelectedIncomingObjectId(objectId);
    setSelectedFinalObjectId(null);
    setSelectedStatementId(null);
    setSelectedFileIds(new Set());
    setSelectedItemIds(new Set());
  };

  const selectFinal = (year: number, objectId: string) => {
    setSelectedYear(year);
    setSelectedObjectId(objectId);
    setSelectedSectionId(null);
    setSelectedFolderId(null);
    setSelectedIncomingObjectId(null);
    setSelectedFinalObjectId(objectId);
    setSelectedStatementId(null);
    setSelectedFileIds(new Set());
    setSelectedItemIds(new Set());
  };

  // CRUD: Objects
  const handleCreateObject = async () => {
    if (!orgId || !newObjName.trim()) return;
    const { data: newObj } = await (supabase.from("material_objects" as any).insert({
      organization_id: orgId, name: newObjName.trim(), year: newObjYear, description: newObjDesc.trim() || null,
    }).select("id").single() as any);
    // Object created — sections are added separately via "Добавить раздел"
    queryClient.invalidateQueries({ queryKey: ["material-objects"] });
    queryClient.invalidateQueries({ queryKey: ["material-sections"] });
    queryClient.invalidateQueries({ queryKey: ["material-folders"] });
    setCreateObjectOpen(false); setNewObjName(""); setNewObjDesc("");
    toast({ title: "Объект создан" });
  };

  const handleDeleteObject = async (objId: string) => {
    await (supabase.from("material_objects" as any).delete().eq("id", objId) as any);
    queryClient.invalidateQueries({ queryKey: ["material-objects"] });
    queryClient.invalidateQueries({ queryKey: ["material-sections"] });
    queryClient.invalidateQueries({ queryKey: ["material-folders"] });
    if (selectedObjectId === objId) { setSelectedObjectId(null); setSelectedYear(null); setSelectedFolderId(null); setSelectedSectionId(null); }
    toast({ title: "Объект удалён" });
  };

  // CRUD: Sections
  const handleCreateSection = async () => {
    if (!orgId || !newSectionName.trim() || !newSectionObjectId) return;
    const objSections = sections.filter(s => s.object_id === newSectionObjectId);
    const maxOrder = objSections.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { data: newSec } = await (supabase.from("material_sections" as any).insert({
      organization_id: orgId, object_id: newSectionObjectId, name: newSectionName.trim(), sort_order: maxOrder + 1,
    }).select("id").single() as any);
    if (newSec?.id) {
      await (supabase.from("material_folders" as any).insert([
        { organization_id: orgId, object_id: newSectionObjectId, section_id: newSec.id, name: "Общие документы", sort_order: 0, type: "general_docs" },
        { organization_id: orgId, object_id: newSectionObjectId, section_id: newSec.id, name: "Работы и материалы", sort_order: 1, type: "materials" },
      ]) as any);
    }
    queryClient.invalidateQueries({ queryKey: ["material-sections"] });
    queryClient.invalidateQueries({ queryKey: ["material-folders"] });
    setCreateSectionOpen(false); setNewSectionName("");
    toast({ title: "Раздел создан" });
  };

  const handleRenameSection = async () => {
    if (!renameSectionDialog || !renameSectionValue.trim()) return;
    await (supabase.from("material_sections" as any).update({ name: renameSectionValue.trim() }).eq("id", renameSectionDialog.id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-sections"] });
    setRenameSectionDialog(null);
    toast({ title: "Раздел переименован" });
  };

  const handleDeleteSection = async (sectionId: string) => {
    // Delete folders, then section (cascade should handle it but be safe)
    await (supabase.from("material_sections" as any).delete().eq("id", sectionId) as any);
    queryClient.invalidateQueries({ queryKey: ["material-sections"] });
    queryClient.invalidateQueries({ queryKey: ["material-folders"] });
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    if (selectedSectionId === sectionId) { setSelectedSectionId(null); setSelectedFolderId(null); }
    toast({ title: "Раздел удалён" });
  };

  // CRUD: Folders
  const handleCreateFolder = async () => {
    if (!orgId || !newFolderName.trim() || !newFolderSectionId || !newFolderObjectId) return;
    const sectionFolders = folders.filter(f => f.section_id === newFolderSectionId);
    const maxOrder = sectionFolders.reduce((m, f) => Math.max(m, f.sort_order), 0);
    await (supabase.from("material_folders" as any).insert({
      organization_id: orgId, object_id: newFolderObjectId, section_id: newFolderSectionId,
      name: newFolderName.trim(), sort_order: maxOrder + 1, type: newFolderType,
    }) as any);
    queryClient.invalidateQueries({ queryKey: ["material-folders"] });
    setCreateFolderOpen(false); setNewFolderName(""); setNewFolderType("materials");
    toast({ title: "Папка создана" });
  };

  // Move file to another folder
  const handleMoveFile = async () => {
    if (!moveFileDialog || !moveTargetFolderId) return;
    await (supabase.from("material_statements" as any).update({ folder_id: moveTargetFolderId }).eq("id", moveFileDialog.id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setMoveFileDialog(null); setMoveTargetFolderId("");
    toast({ title: "Файл перемещён" });
  };

  // Bulk move files
  const handleBulkMove = async () => {
    if (!bulkMoveTargetFolderId || selectedFileIds.size === 0) return;
    const targetFolder = folders.find(f => f.id === bulkMoveTargetFolderId);
    const targetSection = targetFolder ? sections.find(s => s.id === targetFolder.section_id) : null;
    for (const fileId of selectedFileIds) {
      await (supabase.from("material_statements" as any).update({
        folder_id: bulkMoveTargetFolderId,
        section_id: targetSection?.id || null,
      }).eq("id", fileId) as any);
    }
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setBulkMoveOpen(false); setBulkMoveTargetFolderId("");
    toast({ title: `Перемещено файлов: ${selectedFileIds.size}` });
    setSelectedFileIds(new Set());
  };

  // Quick file upload (in folder view)
  const handleQuickUpload = async (fileList: FileList) => {
    if (!orgId || !selectedObjectId || !selectedFolderId || !selectedYear || !selectedSectionId) return;
    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
      const safeFileName = `${Date.now()}_file.${ext || 'pdf'}`;
      const path = `${orgId}/${selectedYear}/${selectedObjectId}/${safeFileName}`;
      const { error: uploadError } = await supabase.storage.from("material-statements").upload(path, file);
      if (uploadError) { toast({ title: "Ошибка", description: uploadError.message, variant: "destructive" }); continue; }
      const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
      await supabase.from("material_statements" as any).insert({
        organization_id: orgId, object_id: selectedObjectId, folder_id: selectedFolderId,
        section_id: selectedSectionId,
        year: selectedYear, file_name: file.name, file_url: urlData.publicUrl,
        file_type: fileType, is_recognized: fileType === "xlsx",
      });
    }
    toast({ title: "Файлы добавлены" });
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
  };

  // Drag and drop for file upload
  const [isDragOverFiles, setIsDragOverFiles] = useState(false);
  const handleFileDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFiles(true);
  }, []);
  const handleFileDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFiles(false);
  }, []);
  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFiles(false);
    if (e.dataTransfer.files?.length) {
      handleQuickUpload(e.dataTransfer.files);
    }
  }, [orgId, selectedObjectId, selectedFolderId, selectedYear, selectedSectionId]);

  // Recognize
  const handleRecognize = async (statement: MaterialStatement) => {
    if (!orgId) return;
    setRecognizingId(statement.id);
    try {
      const { data, error } = await supabase.functions.invoke("recognize-materials", {
        body: { fileUrl: statement.file_url, statementId: statement.id, organizationId: orgId },
      });
      if (error) throw error;
      const warnings = Array.isArray(data?.warnings) ? (data.warnings as string[]) : [];
      toast({
        title: warnings.length > 0 ? "Распознано с предупреждением" : "Распознано",
        description: warnings.length > 0
          ? `Найдено ${data?.count || 0} материалов. ${warnings[0]}`
          : `Найдено ${data?.count || 0} материалов`,
      });
      queryClient.invalidateQueries({ queryKey: ["material-statements"] });
      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      setSelectedStatementId(statement.id);
    } catch (e: any) {
      toast({ title: "Ошибка распознавания", description: e.message, variant: "destructive" });
    } finally {
      setRecognizingId(null);
    }
  };

  const handleDeleteStatement = async (id: string) => {
    await (supabase.from("material_statement_items" as any).delete().eq("statement_id", id) as any);
    await (supabase.from("material_statements" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    if (selectedStatementId === id) setSelectedStatementId(null);
    toast({ title: "Файл удалён" });
  };

  const handleUpdateItem = async (item: MaterialItem) => {
    const totalPrice = (item.quantity != null && item.price != null) ? item.quantity * item.price : null;
    await (supabase.from("material_statement_items" as any).update({
      name: item.name, type_mark: item.type_mark, unit: item.unit,
      quantity: item.quantity, mass_per_unit: item.mass_per_unit,
      price: item.price, total_price: totalPrice, supplier: item.supplier,
    }).eq("id", item.id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setEditingItem(null);
    toast({ title: "Обновлено" });
  };

  const handleDeleteItem = async (id: string) => {
    await (supabase.from("material_statement_items" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
  };

  const handleAddItem = async () => {
    const targetStId = addingToStatementId || selectedStatementId;
    if (!orgId || !targetStId) return;
    const stItems = itemsByStatement.get(targetStId) || [];
    const maxRow = stItems.reduce((m, i) => Math.max(m, i.row_number), 0);
    const price = newItem.price ? Number(newItem.price) : null;
    const qty = newItem.quantity ? Number(newItem.quantity) : null;
    const totalPrice = (qty != null && price != null) ? qty * price : null;
    await (supabase.from("material_statement_items" as any).insert({
      statement_id: targetStId, organization_id: orgId, row_number: maxRow + 1,
      name: newItem.name, type_mark: newItem.type_mark || null, unit: newItem.unit || null,
      quantity: qty, mass_per_unit: newItem.mass_per_unit ? Number(newItem.mass_per_unit) : null,
      price, total_price: totalPrice,
    }) as any);
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    setAddingItem(false); setAddingToStatementId(null);
    setNewItem({ name: "", type_mark: "", unit: "шт", quantity: "", mass_per_unit: "", price: "" });
    toast({ title: "Материал добавлен" });
  };

  const handleRenameStatement = async (stId: string, name: string) => {
    await (supabase.from("material_statements" as any).update({ display_name: name.trim() || null }).eq("id", stId) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    setEditingStatementName(null);
    toast({ title: "Название обновлено" });
  };

  // Bulk actions
  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedFileIds.size === currentStatements.length) setSelectedFileIds(new Set());
    else setSelectedFileIds(new Set(currentStatements.map(s => s.id)));
  };

  const handleBulkRecognize = async () => {
    if (!orgId || selectedFileIds.size === 0) return;
    const toRecognize = currentStatements.filter(s => selectedFileIds.has(s.id) && s.file_type === "pdf");
    if (toRecognize.length === 0) { toast({ title: "Нет PDF файлов для распознавания", variant: "destructive" }); return; }
    setBulkRecognizing(true);
    let successCount = 0, errorCount = 0;
    for (const st of toRecognize) {
      try {
        await (supabase.from("material_statement_items" as any).delete().eq("statement_id", st.id) as any);
        await (supabase.from("material_statements" as any).update({ is_recognized: false }).eq("id", st.id) as any);
        const { error } = await supabase.functions.invoke("recognize-materials", {
          body: { fileUrl: st.file_url, statementId: st.id, organizationId: orgId },
        });
        if (error) throw error;
        successCount++;
      } catch { errorCount++; }
    }
    setBulkRecognizing(false); setSelectedFileIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    toast({ title: `Распознано: ${successCount}`, description: errorCount > 0 ? `Ошибок: ${errorCount}` : undefined });
  };

  const handleBulkDeleteItems = async () => {
    if (selectedItemIds.size === 0) return;
    for (const id of selectedItemIds) {
      await (supabase.from("material_statement_items" as any).delete().eq("id", id) as any);
    }
    setSelectedItemIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["material-items"] });
    toast({ title: `Удалено: ${selectedItemIds.size} материалов` });
  };

  // KP Upload & Matching
  const [kpFileName, setKpFileName] = useState<string>("");
  const [kpApplyLog, setKpApplyLog] = useState<KpApplyLog[]>([]);

  const handleKpUpload = async (file: File) => {
    if (!orgId || allItems.length === 0) {
      toast({ title: "Нет материалов для сопоставления", description: "Сначала загрузите и распознайте ведомости", variant: "destructive" });
      return;
    }
    setKpLoading(true); setKpDialogOpen(true); setKpFileName(file.name);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
      const path = `${orgId}/kp/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("material-statements").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
      const { data, error } = await supabase.functions.invoke("recognize-kp", {
        body: { fileUrl: urlData.publicUrl, fileType },
      });
      if (error) throw error;
      const kpItems: KpItem[] = data.items || [];
      setKpSupplier(data.supplier || null);
      const matches: KpMatch[] = kpItems.map(kpItem => {
        const { item, score } = findBestMatch(kpItem.name, kpItem.unit, allItems);
        const autoMatched = score >= 0.6;
        return {
          kpItem,
          matchedItemId: autoMatched && item ? item.id : null,
          matchedItemName: autoMatched && item ? item.name : null,
          oldPrice: autoMatched && item ? item.price : null,
          similarity: score,
          autoMatched,
          status: (autoMatched && item ? "updated" : "not_found") as "updated" | "not_found",
        };
      });
      setKpMatches(matches);
    } catch (e: any) {
      toast({ title: "Ошибка распознавания КП", description: e.message, variant: "destructive" });
      setKpDialogOpen(false);
    } finally { setKpLoading(false); }
  };

  const handleKpMatchChange = (index: number, itemId: string | null) => {
    setKpMatches(prev => {
      const updated = [...prev];
      const item = itemId ? allItems.find(i => i.id === itemId) : null;
      updated[index] = {
        ...updated[index],
        matchedItemId: itemId,
        matchedItemName: item ? item.name : null,
        oldPrice: item ? item.price : null,
        autoMatched: false,
        status: itemId ? "updated" : "not_found",
      };
      return updated;
    });
  };

  const handleApplyKp = async () => {
    setKpApplying(true);
    let applied = 0;
    const log: KpApplyLog[] = [];
    try {
      for (const match of kpMatches) {
        if (!match.matchedItemId || match.kpItem.price == null) {
          log.push({ materialName: match.kpItem.name, oldPrice: null, newPrice: match.kpItem.price, status: "not_found", fileName: kpFileName });
          continue;
        }
        const item = allItems.find(i => i.id === match.matchedItemId);
        if (!item) {
          log.push({ materialName: match.kpItem.name, oldPrice: null, newPrice: match.kpItem.price, status: "not_found", fileName: kpFileName });
          continue;
        }
        const totalPrice = item.quantity != null ? item.quantity * match.kpItem.price : null;
        await (supabase.from("material_statement_items" as any).update({
          price: match.kpItem.price, total_price: totalPrice, supplier: kpSupplier || undefined,
        }).eq("id", match.matchedItemId) as any);
        log.push({ materialName: item.name, oldPrice: item.price, newPrice: match.kpItem.price, status: "updated", fileName: kpFileName });
        applied++;
      }
      const notFound = log.filter(l => l.status === "not_found").length;
      setKpApplyLog(log);
      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      toast({ title: `КП применено`, description: `Обновлено: ${applied}, Не найдено: ${notFound}` });
      setKpDialogOpen(false); setKpMatches([]);
      console.log("[KP Apply Log]", JSON.stringify(log, null, 2));
    } catch (e: any) {
      toast({ title: "Ошибка применения КП", description: e.message, variant: "destructive" });
    } finally { setKpApplying(false); }
  };

  // ZIP Download
  const handleDownloadZip = async (level: 'folder' | 'section' | 'object', id: string) => {
    if (!orgId) return;
    setDownloadingZip(true);
    try {
      const { data, error } = await supabase.functions.invoke("download-zip", {
        body: { level, id, organizationId: orgId },
      });
      if (error) throw error;

      // data is a Blob
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      let name = "archive";
      if (level === "folder") name = folders.find(f => f.id === id)?.name || "folder";
      else if (level === "section") name = sections.find(s => s.id === id)?.name || "section";
      else if (level === "object") name = objects.find(o => o.id === id)?.name || "object";
      a.download = `${name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Архив скачан" });
    } catch (e: any) {
      toast({ title: "Ошибка скачивания", description: e.message, variant: "destructive" });
    } finally { setDownloadingZip(false); }
  };

  // Merged items for summary/export
  const mergedItems = useMemo(() => {
    const map = new Map<string, MaterialItem>();
    for (const item of allItems) {
      const key = `${item.name.trim().toLowerCase()}|${(item.type_mark || "").trim().toLowerCase()}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.quantity = (existing.quantity || 0) + (item.quantity || 0);
        if (item.price != null && existing.price == null) existing.price = item.price;
        if (item.supplier && !existing.supplier) existing.supplier = item.supplier;
        existing.total_price = (existing.quantity || 0) * (existing.price || 0) || null;
      } else {
        map.set(key, { ...item });
      }
    }
    return [...map.values()].sort((a, b) => a.row_number - b.row_number);
  }, [allItems]);

  const totalCost = useMemo(() =>
    allItems.reduce((sum, item) => sum + (item.total_price || 0), 0),
    [allItems]
  );

  const handleExportExcel = () => {
    const data = mergedItems.map((m, i) => ({
      "№": i + 1, "Наименование": m.name, "Тип / марка": m.type_mark || "",
      "Ед. изм.": m.unit || "", "Кол-во": m.quantity ?? "", "Масса (кг)": m.mass_per_unit ?? "",
      "Цена": m.price ?? "", "Стоимость": m.total_price ?? "", "Поставщик": m.supplier || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [5, 50, 30, 15, 12, 15, 12, 15, 25].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Материалы");
    XLSX.writeFile(wb, `${excelName.trim() || "Ведомость материалов"}.xlsx`);
    setExcelDialogOpen(false); setExcelName("");
    toast({ title: "Excel скачан" });
  };

  const handleSaveExcelToStorage = async () => {
    if (!orgId || !selectedObjectId || !selectedYear || !selectedFolderId) return;
    const data = mergedItems.map((m, i) => ({
      "№": i + 1, "Наименование": m.name, "Тип / марка": m.type_mark || "",
      "Ед. изм.": m.unit || "", "Кол-во": m.quantity ?? "", "Масса (кг)": m.mass_per_unit ?? "",
      "Цена": m.price ?? "", "Стоимость": m.total_price ?? "", "Поставщик": m.supplier || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [5, 50, 30, 15, 12, 15, 12, 15, 25].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Материалы");
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileName = `${excelName.trim() || "Итоговая ведомость"}.xlsx`;
    const path = `${orgId}/${selectedYear}/${selectedObjectId}/${Date.now()}_export.xlsx`;
    const { error } = await supabase.storage.from("material-statements")
      .upload(path, new Blob([wbOut]), { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (error) { toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
    await (supabase.from("material_statements" as any).insert({
      organization_id: orgId, object_id: selectedObjectId, folder_id: selectedFolderId,
      section_id: selectedSectionId,
      year: selectedYear, file_name: fileName, file_url: urlData.publicUrl,
      file_type: "xlsx", is_recognized: true,
    }) as any);
    queryClient.invalidateQueries({ queryKey: ["material-statements"] });
    setExcelDialogOpen(false); setExcelName("");
    toast({ title: "Excel сохранён в папку" });
  };

  const selectedObj = objects.find(o => o.id === selectedObjectId);
  const selectedSection = sections.find(s => s.id === selectedSectionId);
  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const isMaterialsFolder = selectedFolder?.type === 'materials';
  const isGeneralDocsFolder = selectedFolder?.type === 'general_docs';
  const foldersForCurrentSection = folders.filter(f => f.section_id === selectedSectionId);

  const formatPrice = (val: number | null) => {
    if (val == null) return "—";
    return val.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left Tree */}
      <div className="w-80 border-r border-border bg-muted/30 overflow-y-auto flex-shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <h2 className="font-semibold text-sm">Ведомости материалов</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setCreateObjectOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Объект
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
              setCreateSectionOpen(true);
              setNewSectionObjectId(selectedObjectId || "");
            }}>
              <Layers className="h-3 w-3 mr-1" /> Раздел
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
                <div className="ml-3">
                  {node.objects.map(entry => (
                    <div key={entry.object.id}>
                      <button
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-accent/50 rounded-md group"
                        onClick={() => toggleObject(entry.object.id)}
                      >
                        {expandedObjects.has(entry.object.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1 text-left">{entry.object.name}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                          <span title="Скачать архив объекта" onClick={e => { e.stopPropagation(); handleDownloadZip('object', entry.object.id); }}>
                            <Archive className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                          </span>
                          <Trash2
                            className="h-3 w-3 text-destructive cursor-pointer"
                            onClick={e => { e.stopPropagation(); handleDeleteObject(entry.object.id); }}
                          />
                        </div>
                      </button>
                      {expandedObjects.has(entry.object.id) && (
                        <div className="ml-5">
                          {/* Входящие */}
                          <button
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors ${
                              selectedIncomingObjectId === entry.object.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50"
                            }`}
                            onClick={() => selectIncoming(node.year, entry.object.id)}
                          >
                            <Upload className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="truncate flex-1 text-left text-xs font-medium">Входящие</span>
                          </button>
                          {/* Финальная ведомость */}
                          <button
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors ${
                              selectedFinalObjectId === entry.object.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50"
                            }`}
                            onClick={() => selectFinal(node.year, entry.object.id)}
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate flex-1 text-left text-xs font-medium">Финальная ведомость</span>
                          </button>
                          {entry.sections.length === 0 && (
                            <p className="text-xs text-muted-foreground px-2 py-1">Нет разделов</p>
                          )}
                          {entry.sections.map(secEntry => (
                            <div key={secEntry.section.id}>
                              <button
                                className="w-full flex items-center gap-1.5 px-2 py-1 text-sm hover:bg-accent/50 rounded-md group/sec"
                                onClick={() => toggleSection(secEntry.section.id)}
                              >
                                {expandedSections.has(secEntry.section.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate flex-1 text-left text-xs font-medium">{secEntry.section.name}</span>
                                <div className="flex gap-0.5 opacity-0 group-hover/sec:opacity-100 flex-shrink-0">
                                  <span title="Скачать архив раздела" onClick={e => { e.stopPropagation(); handleDownloadZip('section', secEntry.section.id); }}>
                                    <Archive className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
                                  </span>
                                  <Pencil
                                    className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground"
                                    onClick={e => { e.stopPropagation(); setRenameSectionDialog(secEntry.section); setRenameSectionValue(secEntry.section.name); }}
                                  />
                                  <Trash2
                                    className="h-3 w-3 text-destructive cursor-pointer"
                                    onClick={e => { e.stopPropagation(); handleDeleteSection(secEntry.section.id); }}
                                  />
                                </div>
                              </button>
                              {expandedSections.has(secEntry.section.id) && (
                                <div className="ml-5">
                                  {secEntry.folders.map(folder => {
                                    const isActive = selectedFolderId === folder.id;
                                    const folderFileCount = statements.filter(s => s.folder_id === folder.id).length;
                                    return (
                                      <button
                                        key={folder.id}
                                        className={`w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors group/folder ${
                                          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50"
                                        }`}
                                        onClick={() => selectFolder(node.year, entry.object.id, secEntry.section.id, folder.id)}
                                      >
                                        {folder.type === 'general_docs' ? <FileArchive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <Wrench className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                                        <span className="truncate flex-1 text-left text-xs">{folder.name}</span>
                                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{folderFileCount}</Badge>
                                        <span title="Скачать архив папки" onClick={e => { e.stopPropagation(); handleDownloadZip('folder', folder.id); }}>
                                          <Archive className="h-3 w-3 text-muted-foreground opacity-0 group-hover/folder:opacity-100 cursor-pointer hover:text-foreground flex-shrink-0" />
                                        </span>
                                      </button>
                                    );
                                   })}
                                   <button
                                     className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md mt-0.5"
                                     onClick={(e) => { e.stopPropagation(); setCreateFolderOpen(true); setNewFolderSectionId(secEntry.section.id); setNewFolderObjectId(entry.object.id); }}
                                   >
                                     <FolderPlus className="h-3 w-3" /> Добавить папку
                                   </button>
                                 </div>
                              )}
                            </div>
                          ))}
                          <button
                            className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
                            onClick={() => { setCreateSectionOpen(true); setNewSectionObjectId(entry.object.id); }}
                          >
                            <Plus className="h-3 w-3" /> Добавить раздел
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedIncomingObjectId && selectedYear ? (
          <IncomingUploads
            orgId={orgId!}
            objectId={selectedIncomingObjectId}
            objectName={objects.find(o => o.id === selectedIncomingObjectId)?.name || "Объект"}
            year={selectedYear}
            sections={sections as any}
            folders={folders as any}
          />
        ) : selectedFinalObjectId ? (
          <FinalStatement
            orgId={orgId!}
            objectId={selectedFinalObjectId}
            objectName={objects.find(o => o.id === selectedFinalObjectId)?.name || "Объект"}
            sections={sections as any}
            folders={folders as any}
          />
        ) : !selectedFolderId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12" />
            <p>Выберите папку из дерева слева</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateObjectOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Создать объект
              </Button>
              <Button variant="outline" onClick={() => setCreateSectionOpen(true)}>
                <Layers className="h-4 w-4 mr-2" /> Добавить раздел
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{selectedObj?.name || "Объект"}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedYear} год — <span className="font-medium text-foreground">{selectedSection?.name}</span>
                  {" → "}<span className="font-medium text-foreground">{selectedFolder?.name}</span>
                  {isMaterialsFolder && totalCost > 0 && (
                    <span className="ml-3 text-primary font-semibold">
                      Итого: {totalCost.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {downloadingZip && <Loader2 className="h-4 w-4 animate-spin" />}
                {isMaterialsFolder && allItems.length > 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4 mr-1" /> Загрузить КП
                      <input type="file" accept=".pdf,.xlsx,.xls" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) { handleKpUpload(e.target.files[0]); e.target.value = ""; } }}
                      />
                    </label>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-1" /> Добавить файлы
                    <input type="file" accept={isGeneralDocsFolder ? ".pdf,.doc,.docx,.dwg" : ".pdf,.xlsx,.xls"} multiple className="hidden"
                      onChange={e => { if (e.target.files) { handleQuickUpload(e.target.files); e.target.value = ""; } }}
                    />
                  </label>
                </Button>
                {isMaterialsFolder && mergedItems.length > 0 && (
                  <Button size="sm" onClick={() => setExcelDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-1" /> Скачать Excel
                  </Button>
                )}
                {isMaterialsFolder && allItems.length > 0 && (
                  <Button size="sm" onClick={() => { setProcurementMode("all"); setProcurementDialogOpen(true); }}>
                    <ShoppingCart className="h-4 w-4 mr-1" /> Создать заявку
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleDownloadZip('folder', selectedFolderId!)} disabled={downloadingZip}>
                  <Archive className="h-4 w-4 mr-1" /> ZIP
                </Button>
                {selectedObjectId && orgId && selectedObj && (
                  <ConsolidatedExcelExportButton
                    objectId={selectedObjectId}
                    objectName={selectedObj.name}
                    organizationId={orgId}
                  />
                )}
              </div>
            </div>

            {/* Files table */}
            <div
              className="relative"
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
            {isDragOverFiles && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-primary" />
                  <p className="text-sm font-medium text-primary">Отпустите файлы для загрузки</p>
                </div>
              </div>
            )}
            <Card>
              <CardHeader className="py-3 flex-row items-center justify-between">
                <CardTitle className="text-sm">Файлы ({currentStatements.length})</CardTitle>
                {selectedFileIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Выбрано: {selectedFileIds.size}</span>
                    <Button size="sm" variant="outline" onClick={() => { setBulkMoveOpen(true); setBulkMoveTargetFolderId(""); }}>
                      <MoveRight className="h-4 w-4 mr-1" /> Переместить
                    </Button>
                    {isMaterialsFolder && (
                      <Button size="sm" variant="outline" onClick={handleBulkRecognize} disabled={bulkRecognizing}>
                        {bulkRecognizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Распознать заново
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={currentStatements.length > 0 && selectedFileIds.size === currentStatements.length} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead>Файл</TableHead>
                      <TableHead>Тип</TableHead>
                      {isMaterialsFolder && <TableHead>Статус</TableHead>}
                      <TableHead>Дата</TableHead>
                      <TableHead className="w-[240px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStatements.map(st => (
                      <TableRow key={st.id} className={`cursor-pointer ${selectedStatementId === st.id ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedStatementId(st.id)}>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedFileIds.has(st.id)} onCheckedChange={() => toggleFileSelection(st.id)} />
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <a href={st.file_url} target="_blank" rel="noopener" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                            {st.file_name}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.file_type === "pdf" ? "destructive" : "default"}>{st.file_type.toUpperCase()}</Badge>
                        </TableCell>
                        {isMaterialsFolder && (
                          <TableCell>
                            {st.is_recognized
                              ? <Badge variant="outline" className="text-green-600 border-green-300">Распознано</Badge>
                              : <Badge variant="secondary">Не распознано</Badge>}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(st.created_at).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {isMaterialsFolder && st.file_type === "pdf" && (
                              <Button size="sm" variant="outline" onClick={() => handleRecognize(st)} disabled={recognizingId === st.id}>
                                {recognizingId === st.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                                Распознать
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" title="Переместить" onClick={() => { setMoveFileDialog(st); setMoveTargetFolderId(""); }}>
                              <MoveRight className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteStatement(st.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {currentStatements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isMaterialsFolder ? 6 : 5} className="text-center text-muted-foreground py-8">Нет загруженных файлов</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </div>

            {/* Procurement Summary */}
            {selectedFolderId && isMaterialsFolder && allItems.length > 0 && (() => {
              const totalMaterials = allItems.length;
              const procuredCount = allItems.filter(i => i.procurement_status && i.procurement_status !== "none").length;
              const deliveredCount = allItems.filter(i => i.procurement_status === "delivered").length;
              const remainingCount = totalMaterials - procuredCount;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Всего материалов</p>
                    <p className="text-xl font-bold">{totalMaterials}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">В закупке</p>
                    <p className="text-xl font-bold text-amber-600">{procuredCount - deliveredCount}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Доставлено</p>
                    <p className="text-xl font-bold text-emerald-600">{deliveredCount}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Осталось купить</p>
                    <p className="text-xl font-bold text-primary">{remainingCount}</p>
                  </Card>
                </div>
              );
            })()}

            {/* Per-file material sections - only for materials folders */}
            {selectedFolderId && isMaterialsFolder && (
              <>
                {itemsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  currentStatements.filter(st => st.is_recognized || (itemsByStatement.get(st.id) || []).length > 0).map(st => {
                    const stItems = itemsByStatement.get(st.id) || [];
                    const allSelected = stItems.length > 0 && stItems.every(i => selectedItemIds.has(i.id));
                    const someSelected = stItems.some(i => selectedItemIds.has(i.id));
                    const sectionName = st.display_name || st.file_name;
                    const sectionTotal = stItems.reduce((s, i) => s + (i.total_price || 0), 0);
                    return (
                      <Card key={st.id}>
                        <CardHeader className="py-3 flex-row items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {editingStatementName === st.id ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input value={statementNameValue} onChange={e => setStatementNameValue(e.target.value)} className="h-7 text-sm" autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") handleRenameStatement(st.id, statementNameValue); if (e.key === "Escape") setEditingStatementName(null); }} />
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleRenameStatement(st.id, statementNameValue)}>✓</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingStatementName(null)}>✕</Button>
                              </div>
                            ) : (
                              <CardTitle className="text-sm cursor-pointer hover:text-primary truncate"
                                onClick={() => { setEditingStatementName(st.id); setStatementNameValue(st.display_name || st.file_name); }}
                                title="Нажмите для переименования">
                                {sectionName}
                                <span className="text-muted-foreground font-normal ml-2">({stItems.length})</span>
                                {sectionTotal > 0 && (
                                  <span className="text-primary font-normal ml-2">
                                    {sectionTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                                  </span>
                                )}
                                <Pencil className="h-3 w-3 inline ml-1 text-muted-foreground" />
                              </CardTitle>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {someSelected && (
                              <>
                                <Button size="sm" variant="destructive" onClick={handleBulkDeleteItems}>
                                  <Trash2 className="h-4 w-4 mr-1" /> Удалить ({[...selectedItemIds].filter(id => stItems.some(i => i.id === id)).length})
                                </Button>
                                <Button size="sm" onClick={() => { setProcurementMode("selected"); setProcurementDialogOpen(true); }}>
                                  <ShoppingCart className="h-4 w-4 mr-1" /> Создать заявку ({[...selectedItemIds].filter(id => stItems.some(i => i.id === id)).length})
                                </Button>
                              </>
                            )}
                            {stItems.length > 0 && (
                              <Button size="sm" variant="outline" onClick={() => {
                                const d = stItems.map((m, i) => ({
                                  "№": i + 1, "Наименование": m.name, "Тип / марка": m.type_mark || "",
                                  "Ед. изм.": m.unit || "", "Кол-во": m.quantity ?? "", "Масса (кг)": m.mass_per_unit ?? "",
                                  "Цена": m.price ?? "", "Стоимость": m.total_price ?? "",
                                }));
                                const ws = XLSX.utils.json_to_sheet(d);
                                ws["!cols"] = [5, 50, 30, 15, 12, 15, 12, 15].map(w => ({ wch: w }));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Материалы");
                                XLSX.writeFile(wb, `${sectionName}.xlsx`);
                              }}>
                                <Download className="h-4 w-4 mr-1" /> Excel
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setAddingItem(true); setAddingToStatementId(st.id); }}>
                              <Plus className="h-4 w-4 mr-1" /> Добавить
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">
                                  <Checkbox checked={allSelected} onCheckedChange={() => {
                                    setSelectedItemIds(prev => {
                                      const next = new Set(prev);
                                      if (allSelected) stItems.forEach(i => next.delete(i.id));
                                      else stItems.forEach(i => next.add(i.id));
                                      return next;
                                    });
                                  }} />
                                </TableHead>
                                <TableHead className="w-12">№</TableHead>
                                <TableHead>Наименование</TableHead>
                                <TableHead>Тип / марка</TableHead>
                                <TableHead className="w-20">Ед. изм.</TableHead>
                                <TableHead className="w-24">Кол-во</TableHead>
                                <TableHead className="w-24">Масса (кг)</TableHead>
                                <TableHead className="w-24">Цена</TableHead>
                                <TableHead className="w-28">Стоимость</TableHead>
                                <TableHead className="w-28">Закупка</TableHead>
                                <TableHead className="w-20"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stItems.map((item, idx) => {
                                const isEditing = editingItem?.id === item.id;
                                const computedTotal = (item.quantity != null && item.price != null) ? item.quantity * item.price : null;
                                const isProcured = item.procurement_status && item.procurement_status !== "none";
                                return (
                                  <TableRow key={item.id} className={isProcured ? "bg-muted/40" : ""}>
                                    <TableCell>
                                      <Checkbox checked={selectedItemIds.has(item.id)} onCheckedChange={() => {
                                        setSelectedItemIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
                                      }} />
                                    </TableCell>
                                    <TableCell>{idx + 1}</TableCell>
                                    <TableCell>{isEditing ? <Input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="h-8" /> : item.name}</TableCell>
                                    <TableCell>{isEditing ? <Input value={editingItem.type_mark || ""} onChange={e => setEditingItem({ ...editingItem, type_mark: e.target.value })} className="h-8" /> : item.type_mark || "—"}</TableCell>
                                    <TableCell>{isEditing ? <Input value={editingItem.unit || ""} onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })} className="h-8 w-16" /> : item.unit || "—"}</TableCell>
                                    <TableCell>{isEditing ? <Input type="number" value={editingItem.quantity ?? ""} onChange={e => setEditingItem({ ...editingItem, quantity: e.target.value ? Number(e.target.value) : null })} className="h-8 w-20" /> : item.quantity ?? "—"}</TableCell>
                                    <TableCell>{isEditing ? <Input type="number" value={editingItem.mass_per_unit ?? ""} onChange={e => setEditingItem({ ...editingItem, mass_per_unit: e.target.value ? Number(e.target.value) : null })} className="h-8 w-20" /> : item.mass_per_unit ?? "—"}</TableCell>
                                    <TableCell>{isEditing ? <Input type="number" value={editingItem.price ?? ""} onChange={e => setEditingItem({ ...editingItem, price: e.target.value ? Number(e.target.value) : null })} className="h-8 w-20" /> : formatPrice(item.price)}</TableCell>
                                    <TableCell className="font-medium">{formatPrice(computedTotal)}</TableCell>
                                    <TableCell>
                                      {item.procurement_status === "in_procurement" && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">🟡 в закупке</Badge>
                                      )}
                                      {item.procurement_status === "ordered" && (
                                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">🔵 заказано</Badge>
                                      )}
                                      {item.procurement_status === "delivered" && (
                                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">🟢 доставлено</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        {isEditing
                                          ? <Button size="sm" variant="ghost" onClick={() => handleUpdateItem(editingItem)}>✓</Button>
                                          : <Button size="sm" variant="ghost" onClick={() => setEditingItem({ ...item })}><Pencil className="h-3 w-3" /></Button>}
                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {addingItem && addingToStatementId === st.id && (
                                <TableRow>
                                  <TableCell />
                                  <TableCell>+</TableCell>
                                  <TableCell><Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="h-8" placeholder="Наименование" /></TableCell>
                                  <TableCell><Input value={newItem.type_mark} onChange={e => setNewItem({ ...newItem, type_mark: e.target.value })} className="h-8" placeholder="Тип/марка" /></TableCell>
                                  <TableCell><Input value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} className="h-8 w-16" /></TableCell>
                                  <TableCell><Input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} className="h-8 w-20" /></TableCell>
                                  <TableCell><Input type="number" value={newItem.mass_per_unit} onChange={e => setNewItem({ ...newItem, mass_per_unit: e.target.value })} className="h-8 w-20" /></TableCell>
                                  <TableCell><Input type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} className="h-8 w-20" placeholder="Цена" /></TableCell>
                                  <TableCell>—</TableCell>
                                  <TableCell></TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={handleAddItem} disabled={!newItem.name}>✓</Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setAddingItem(false); setAddingToStatementId(null); }}>✕</Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                              {stItems.length === 0 && !(addingItem && addingToStatementId === st.id) && (
                                <TableRow>
                                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">Нет распознанных материалов</TableCell>
                                </TableRow>
                              )}
                              {stItems.length > 0 && (
                                <TableRow className="bg-muted/50 font-semibold">
                                  <TableCell />
                                  <TableCell />
                                  <TableCell colSpan={4} className="text-right text-sm">Итого по файлу:</TableCell>
                                  <TableCell />
                                  <TableCell />
                                  <TableCell className="text-sm">{sectionTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽</TableCell>
                                  <TableCell />
                                  <TableCell />
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
                {allItems.length > 0 && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="py-4 flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-3">
                        <span>Итого по разделу</span>
                        <Badge variant="secondary">{allItems.length} позиций</Badge>
                        {allItems.length !== mergedItems.length && (
                          <Badge variant="outline">{mergedItems.length} уникальных</Badge>
                        )}
                      </CardTitle>
                      <span className="text-lg font-bold text-primary">
                        {totalCost.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
                      </span>
                    </CardHeader>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Object Dialog */}
      <Dialog open={createObjectOpen} onOpenChange={setCreateObjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Создать объект</DialogTitle></DialogHeader>
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
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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

      {/* Create Section Dialog */}
      <Dialog open={createSectionOpen} onOpenChange={setCreateSectionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Создать раздел</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Объект</label>
              <Select value={newSectionObjectId} onValueChange={setNewSectionObjectId}>
                <SelectTrigger><SelectValue placeholder="Выберите объект" /></SelectTrigger>
                <SelectContent>
                  {objects.map(o => <SelectItem key={o.id} value={o.id}>{o.name} ({o.year})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Название раздела</label>
              <Input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Например: ОВ, ВК, ЭОМ" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSection} disabled={!newSectionName.trim() || !newSectionObjectId}>
              <Layers className="h-4 w-4 mr-1" /> Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Section Dialog */}
      <Dialog open={!!renameSectionDialog} onOpenChange={open => { if (!open) setRenameSectionDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Переименовать раздел</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={renameSectionValue} onChange={e => setRenameSectionValue(e.target.value)} placeholder="Новое название"
              onKeyDown={e => { if (e.key === "Enter") handleRenameSection(); }} />
          </div>
          <DialogFooter>
            <Button onClick={handleRenameSection} disabled={!renameSectionValue.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Создать папку</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название папки</label>
              <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Например: Спецификации, Чертежи"
                onKeyDown={e => { if (e.key === "Enter" && newFolderName.trim()) handleCreateFolder(); }} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Тип папки</label>
              <Select value={newFolderType} onValueChange={setNewFolderType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="materials">Работы и материалы</SelectItem>
                  <SelectItem value="general_docs">Общие документы</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              <FolderPlus className="h-4 w-4 mr-1" /> Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move File Dialog */}
      <Dialog open={!!moveFileDialog} onOpenChange={open => { if (!open) setMoveFileDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Переместить файл</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Файл: <strong>{moveFileDialog?.file_name}</strong></p>
            <div>
              <label className="text-sm font-medium">В папку</label>
              <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
                <SelectTrigger><SelectValue placeholder="Выберите папку" /></SelectTrigger>
                <SelectContent>
                  {foldersForCurrentSection
                    .filter(f => f.id !== moveFileDialog?.folder_id)
                    .map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleMoveFile} disabled={!moveTargetFolderId}>
              <MoveRight className="h-4 w-4 mr-1" /> Переместить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveOpen} onOpenChange={open => { if (!open) setBulkMoveOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Массовый перенос файлов ({selectedFileIds.size})</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Выбрано файлов: <strong>{selectedFileIds.size}</strong>
            </p>
            <div>
              <label className="text-sm font-medium">Целевая папка</label>
              <Select value={bulkMoveTargetFolderId} onValueChange={setBulkMoveTargetFolderId}>
                <SelectTrigger><SelectValue placeholder="Выберите папку" /></SelectTrigger>
                <SelectContent>
                  {sections
                    .filter(s => objects.some(o => o.id === s.object_id))
                    .map(sec => {
                      const obj = objects.find(o => o.id === sec.object_id);
                      const secFolders = folders.filter(f => f.section_id === sec.id && f.id !== selectedFolderId);
                      if (secFolders.length === 0) return null;
                      return (
                        <div key={sec.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {obj?.name} → {sec.name}
                          </div>
                          {secFolders.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.type === 'general_docs' ? '📦' : '🔧'} {f.name}
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkMove} disabled={!bulkMoveTargetFolderId}>
              <MoveRight className="h-4 w-4 mr-1" /> Переместить ({selectedFileIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Export Dialog */}
      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Экспорт Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название файла</label>
              <Input value={excelName} onChange={e => setExcelName(e.target.value)} placeholder="Ведомость материалов" />
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

      {/* KP Matching Dialog */}
      <Dialog open={kpDialogOpen} onOpenChange={open => { if (!open && !kpLoading && !kpApplying) { setKpDialogOpen(false); setKpMatches([]); } }}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Сопоставление КП с материалами
              {kpSupplier && <span className="text-sm font-normal text-muted-foreground ml-2">— {kpSupplier}</span>}
              {kpFileName && <span className="text-xs font-normal text-muted-foreground ml-2">({kpFileName})</span>}
            </DialogTitle>
          </DialogHeader>
          {kpLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Распознавание коммерческого предложения...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  Всего: <strong>{kpMatches.length}</strong>
                </Badge>
                <Badge variant="default" className="gap-1 bg-emerald-600">
                  Обновлено: <strong>{kpMatches.filter(m => m.matchedItemId).length}</strong>
                </Badge>
                <Badge variant="destructive" className="gap-1">
                  Не найдено: <strong>{kpMatches.filter(m => !m.matchedItemId).length}</strong>
                </Badge>
              </div>
              <ScrollArea className="flex-1 max-h-[55vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">№</TableHead>
                      <TableHead>Материал</TableHead>
                      <TableHead className="w-24">Было</TableHead>
                      <TableHead className="w-24">Стало</TableHead>
                      <TableHead>Сопоставление</TableHead>
                      <TableHead className="w-28">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpMatches.map((match, idx) => {
                      const isMatched = !!match.matchedItemId;
                      const priceChanged = isMatched && match.kpItem.price != null && match.oldPrice !== match.kpItem.price;
                      return (
                        <TableRow key={idx} className={cn(
                          !isMatched && "bg-destructive/5",
                          isMatched && priceChanged && "bg-emerald-50 dark:bg-emerald-950/20",
                        )}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{match.kpItem.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isMatched && match.oldPrice != null ? formatPrice(match.oldPrice) : "—"}
                          </TableCell>
                          <TableCell className={cn("text-sm font-medium", priceChanged && "text-emerald-600 dark:text-emerald-400")}>
                            {match.kpItem.price != null ? formatPrice(match.kpItem.price) : "—"}
                          </TableCell>
                          <TableCell>
                            <Select value={match.matchedItemId || "__none__"} onValueChange={v => handleKpMatchChange(idx, v === "__none__" ? null : v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Не сопоставлено" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Не сопоставлено —</SelectItem>
                                {allItems.map(item => (
                                  <SelectItem key={item.id} value={item.id}>{item.name.substring(0, 80)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {isMatched ? (
                              <Badge variant="default" className="bg-emerald-600 text-xs">обновлено</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">не найден</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setKpDialogOpen(false); setKpMatches([]); }}>Отмена</Button>
                <Button onClick={handleApplyKp} disabled={kpApplying || kpMatches.filter(m => m.matchedItemId).length === 0}>
                  {kpApplying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Применить изменения ({kpMatches.filter(m => m.matchedItemId && m.kpItem.price != null).length})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Procurement Dialog */}
      <CreateProcurementDialog
        open={procurementDialogOpen}
        onOpenChange={setProcurementDialogOpen}
        items={procurementMode === "selected"
          ? allItems.filter(i => selectedItemIds.has(i.id))
          : allItems
        }
        orgId={orgId || ""}
        objectName={selectedObj?.name}
        sectionName={selectedSection?.name}
      />
    </div>
  );
}
