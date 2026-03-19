import { useState, useRef, useCallback, useMemo, type DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Loader2, Check, AlertTriangle, File, Trash2,
  MoveRight, Sparkles, FileText, FileSpreadsheet, RefreshCw,
  ArrowRight, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HighlightText } from "@/components/HighlightText";
import { matchesMaterialSearch } from "@/lib/materialSearch";
import { findBestParametricMatch } from "@/lib/materialParametricMatch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ── Types ──

interface ExtractedRow {
  name: string;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  total_price: number | null;
}

interface MatchResult {
  extracted: ExtractedRow;
  matchedItemId: string | null;
  matchedItemName: string | null;
  oldPrice: number | null;
  oldQuantity: number | null;
  similarity: number;
  status: "updated" | "not_found";
  matchType?: "exact" | "fuzzy" | "parametric" | "not_found";
  matchDescription?: string | null;
}

interface ExistingItem {
  id: string;
  name: string;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  statement_id: string;
}

interface IncomingFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  status: "uploading" | "recognizing" | "classifying" | "ready" | "applying" | "done" | "error";
  extractedRows?: ExtractedRow[];
  matches?: MatchResult[];
  sectionName?: string | null;
  sectionId?: string | null;
  folderId?: string | null;
  docType?: string | null;
  confidence?: number;
  error?: string;
}

interface Section {
  id: string;
  name: string;
  object_id: string;
}

interface Folder {
  id: string;
  section_id: string | null;
  name: string;
  type: string;
}

interface IncomingUploadsProps {
  orgId: string;
  objectId: string;
  objectName: string;
  year: number;
  sections: Section[];
  folders: Folder[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploading: { label: "Загрузка...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  recognizing: { label: "Распознавание...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  classifying: { label: "Определение раздела...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  ready: { label: "Готово к применению", icon: <Check className="h-3 w-3" />, variant: "default" },
  applying: { label: "Применение...", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "secondary" },
  done: { label: "Применено", icon: <Check className="h-3 w-3" />, variant: "default" },
  error: { label: "Ошибка", icon: <AlertTriangle className="h-3 w-3" />, variant: "destructive" },
};

// ── Material matching: exact → parametric (ignoring ГОСТ/ОСТ/ТУ/СТО) → fuzzy ──

const UNIT_ALIASES: Record<string, string> = {
  "шт": "шт", "шт.": "шт", "штук": "шт", "штука": "шт",
  "м": "м", "м.": "м", "метр": "м", "мп": "м", "м.п.": "м", "м п": "м",
  "кг": "кг", "кг.": "кг", "килограмм": "кг",
  "т": "т", "т.": "т", "тонна": "т", "тн": "т",
  "м2": "м2", "м²": "м2", "кв.м": "м2", "кв м": "м2", "кв.м.": "м2",
  "м3": "м3", "м³": "м3", "куб.м": "м3", "куб м": "м3", "куб.м.": "м3",
  "л": "л", "л.": "л", "литр": "л",
  "компл": "компл", "компл.": "компл", "комплект": "компл", "к-т": "компл",
  "уп": "уп", "уп.": "уп", "упак": "уп", "упаковка": "уп",
};

function normalizeUnit(unit: string | null): string {
  if (!unit) return "";
  const key = unit.toLowerCase().trim();
  return UNIT_ALIASES[key] || key;
}

function findBestMatch(
  extracted: ExtractedRow,
  existingItems: ExistingItem[]
): { item: ExistingItem | null; score: number; matchType: "exact" | "fuzzy" | "parametric" | "not_found"; matchDescription: string | null } {
  const result = findBestParametricMatch(
    extracted.name,
    normalizeUnit(extracted.unit),
    existingItems.map((item) => ({
      id: item.id,
      name: item.name,
      unit: normalizeUnit(item.unit),
      price: item.price,
    }))
  );

  if (!result) {
    return { item: null, score: 0, matchType: "not_found", matchDescription: null };
  }

  const matchedItem = existingItems.find((item) => item.id === result.itemId) ?? null;
  if (!matchedItem) {
    return { item: null, score: 0, matchType: "not_found", matchDescription: null };
  }

  return {
    item: matchedItem,
    score: result.score,
    matchType: result.matchType,
    matchDescription: result.matchDescription,
  };
}

// ── Excel parsing ──

function parseExcelFile(file: File): Promise<ExtractedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (json.length === 0) {
          resolve([]);
          return;
        }

        // Auto-detect column names
        const cols = Object.keys(json[0]);
        const findCol = (patterns: string[]): string | null => {
          for (const col of cols) {
            const lc = col.toLowerCase();
            for (const p of patterns) {
              if (lc.includes(p)) return col;
            }
          }
          return null;
        };

        const nameCol = findCol(["наименование", "название", "name", "материал", "товар", "позиция"]);
        const unitCol = findCol(["ед", "unit", "единица", "изм"]);
        const qtyCol = findCol(["кол", "quantity", "количество"]);
        const priceCol = findCol(["цена", "price", "стоимость за ед", "цена за ед"]);
        const totalCol = findCol(["сумма", "стоимость", "total", "итого", "всего"]);

        if (!nameCol) {
          reject(new Error("Не найден столбец с наименованием"));
          return;
        }

        const parseNum = (val: any): number | null => {
          if (val === null || val === undefined || val === "") return null;
          if (typeof val === "number") return Number.isFinite(val) ? val : null;
          const s = String(val).replace(/\s/g, "").replace(",", ".");
          const n = Number(s);
          return Number.isFinite(n) ? n : null;
        };

        const rows: ExtractedRow[] = json
          .map(row => ({
            name: String(row[nameCol] || "").trim(),
            unit: unitCol ? (String(row[unitCol] || "").trim() || null) : null,
            quantity: qtyCol ? parseNum(row[qtyCol]) : null,
            price: priceCol ? parseNum(row[priceCol]) : null,
            total_price: totalCol ? parseNum(row[totalCol]) : null,
          }))
          .filter(r => r.name.length > 0);

        console.log(`[parseExcel] Extracted ${rows.length} rows from "${sheetName}"`);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Component ──

export function IncomingUploads({
  orgId,
  objectId,
  objectName,
  year,
  sections,
  folders,
}: IncomingUploadsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<IncomingFile[]>([]);
  const [reviewFile, setReviewFile] = useState<IncomingFile | null>(null);
  const [reviewSearch, setReviewSearch] = useState("");
  const [manualSectionDialog, setManualSectionDialog] = useState<IncomingFile | null>(null);
  const [manualSectionId, setManualSectionId] = useState<string>("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const objectSections = sections.filter((s) => s.object_id === objectId);

  // ── Load previously uploaded files from DB ──
  const { data: savedFiles } = useQuery({
    queryKey: ["incoming-files-history", orgId, objectId, year],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("material_statements" as any)
        .select("id, file_name, file_url, file_type, is_recognized, classification_status, section_id, folder_id, detected_doc_type")
        .eq("organization_id", orgId)
        .eq("object_id", objectId)
        .eq("year", year)
        .is("folder_id", null)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId && !!objectId,
  });

  // Merge saved files into local state (only once on load)
  useMemo(() => {
    if (!savedFiles || savedFiles.length === 0 || historyLoaded) return;
    const existingIds = new Set(files.map(f => f.id));
    const newFiles: IncomingFile[] = savedFiles
      .filter((sf: any) => !existingIds.has(sf.id))
      .map((sf: any) => {
        const section = sections.find(s => s.id === sf.section_id);
        return {
          id: sf.id,
          fileName: sf.file_name,
          fileUrl: sf.file_url,
          fileType: sf.file_type,
          status: sf.classification_status === "done" ? "done" as const
            : sf.is_recognized ? "ready" as const
            : "error" as const,
          sectionId: sf.section_id,
          sectionName: section?.name || null,
          folderId: sf.folder_id,
          docType: sf.detected_doc_type,
        };
      });
    if (newFiles.length > 0) {
      setFiles(prev => [...newFiles, ...prev]);
    }
    setHistoryLoaded(true);
  }, [savedFiles, historyLoaded]);

  const updateFile = useCallback((id: string, updates: Partial<IncomingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  // Fetch existing items for matching — get all items across all sections of this object
  const sectionIds = useMemo(() => objectSections.map(s => s.id), [objectSections]);
  const folderIds = useMemo(() => folders.filter(f => f.section_id && sectionIds.includes(f.section_id) && f.type === "materials").map(f => f.id), [folders, sectionIds]);

  const { data: existingItems = [] } = useQuery({
    queryKey: ["incoming-existing-items", orgId, objectId],
    queryFn: async () => {
      if (!orgId || folderIds.length === 0) return [];
      // Get statements in these folders
      const { data: stmts } = await (supabase
        .from("material_statements" as any).select("id")
        .eq("organization_id", orgId)
        .in("folder_id", folderIds) as any);
      const stmtIds = (stmts || []).map((s: any) => s.id);
      if (stmtIds.length === 0) return [];

      // Get all items
      const PAGE_SIZE = 1000;
      let all: ExistingItem[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase
          .from("material_statement_items" as any)
          .select("id, name, unit, quantity, price, statement_id")
          .in("statement_id", stmtIds)
          .range(from, from + PAGE_SIZE - 1) as any);
        const chunk = (data || []) as ExistingItem[];
        all = all.concat(chunk);
        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    enabled: !!orgId && folderIds.length > 0,
  });

  // ── Process file: Upload → Recognize → Classify → Match ──
  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const fileType = ext === "xlsx" || ext === "xls" ? "xlsx" : "pdf";
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const incomingFile: IncomingFile = {
      id: tempId,
      fileName: file.name,
      fileUrl: "",
      fileType,
      status: "uploading",
    };
    setFiles((prev) => [...prev, incomingFile]);

    try {
      // 1. Upload to storage
      const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext || "pdf"}`;
      const path = `${orgId}/${year}/${objectId}/incoming/${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from("material-statements")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("material-statements").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // 2. Create DB record
      const { data: stData, error: stError } = await (supabase
        .from("material_statements" as any)
        .insert({
          organization_id: orgId,
          object_id: objectId,
          folder_id: null,
          section_id: null,
          year,
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType,
          is_recognized: false,
          classification_status: "pending",
        })
        .select("id")
        .single() as any);
      if (stError) throw stError;

      const statementId = stData.id;
      updateFile(tempId, { id: statementId, fileUrl });

      // 3. RECOGNIZE FIRST — extract table data
      updateFile(statementId, { status: "recognizing" });
      let extractedRows: ExtractedRow[] = [];

      if (fileType === "xlsx") {
        // Client-side Excel parsing
        try {
          extractedRows = await parseExcelFile(file);
          console.log(`[IncomingUploads] Excel parsed: ${extractedRows.length} rows from "${file.name}"`);
        } catch (excelErr: any) {
          console.error(`[IncomingUploads] Excel parse error for "${file.name}":`, excelErr.message);
          updateFile(statementId, { status: "error", error: `Ошибка парсинга Excel: ${excelErr.message}` });
          return;
        }
      } else {
        // PDF — call recognize-materials edge function
        try {
          const { data: recData, error: recError } = await supabase.functions.invoke("recognize-materials", {
            body: { fileUrl, statementId, organizationId: orgId },
          });
          if (recError) throw recError;
          // Convert recognized materials to ExtractedRow format
          const materials = recData?.materials || [];
          extractedRows = materials.map((m: any) => ({
            name: m.name || "",
            unit: m.unit || null,
            quantity: m.quantity ?? null,
            price: null, // PDF ведомости обычно не содержат цен
            total_price: null,
          }));
          console.log(`[IncomingUploads] PDF recognized: ${extractedRows.length} rows from "${file.name}"`);
        } catch (recErr: any) {
          console.error(`[IncomingUploads] PDF recognition error for "${file.name}":`, recErr.message);
          updateFile(statementId, { status: "error", error: `Ошибка распознавания PDF: ${recErr.message}` });
          return;
        }
      }

      if (extractedRows.length === 0) {
        updateFile(statementId, { status: "error", error: "Не удалось извлечь строки из файла" });
        await (supabase.from("material_statements" as any).update({ classification_status: "error" }).eq("id", statementId) as any);
        return;
      }

      // Mark as recognized in DB
      await (supabase.from("material_statements" as any).update({ is_recognized: true }).eq("id", statementId) as any);

      // 4. CLASSIFY — determine section
      updateFile(statementId, { status: "classifying" });
      let sectionId: string | null = null;
      let sectionName: string | null = null;
      let folderId: string | null = null;
      let docType: string | null = null;
      let confidence = 0;

      try {
        const { data: classifyData, error: classifyError } = await supabase.functions.invoke("classify-document", {
          body: {
            statementId,
            organizationId: orgId,
            objectId,
            fileName: file.name,
            fileUrl,
            fileType,
          },
        });
        if (!classifyError && classifyData) {
          sectionId = classifyData.sectionId;
          sectionName = classifyData.sectionName;
          folderId = classifyData.folderId;
          docType = classifyData.docType;
          confidence = classifyData.confidence || 0;
          // Persist classification results
          await (supabase.from("material_statements" as any).update({
            section_id: sectionId,
            folder_id: folderId,
            detected_doc_type: docType,
            classification_status: "classified",
          }).eq("id", statementId) as any);
        }
      } catch (classifyErr: any) {
        console.warn(`[IncomingUploads] Classification failed for "${file.name}":`, classifyErr.message);
        // Non-fatal — user can select section manually
      }

      // 5. MATCH extracted rows against existing items
      const matches: MatchResult[] = extractedRows.map(row => {
        // Filter existing items by section if classified
        let targetItems = existingItems;
        if (sectionId) {
          const sectionFolderIds = folders
            .filter(f => f.section_id === sectionId && f.type === "materials")
            .map(f => f.id);
          // Get statement IDs in section folders — for now match against all object items
          // since we already filtered by object
        }

        const { item, score, matchType, matchDescription } = findBestMatch(row, targetItems);
        const matched = !!item;
        console.log(`[IncomingUploads] MATCH TYPE: ${matchType}`);
        return {
          extracted: row,
          matchedItemId: matched ? item!.id : null,
          matchedItemName: matched ? item!.name : null,
          oldPrice: matched ? item!.price : null,
          oldQuantity: matched ? item!.quantity : null,
          similarity: score,
          status: (matched ? "updated" : "not_found") as "updated" | "not_found",
          matchType,
          matchDescription,
        };
      });

      updateFile(statementId, {
        status: "ready",
        extractedRows,
        matches,
        sectionId,
        sectionName,
        folderId,
        docType,
        confidence,
      });

    } catch (err: any) {
      console.error(`[IncomingUploads] Error processing "${file.name}":`, err.message);
      updateFile(tempId, { status: "error", error: err.message });
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    }
  };

  // ── Apply changes — update prices for matched items ──
  const handleApplyChanges = async (file: IncomingFile) => {
    if (!file.matches) return;
    updateFile(file.id, { status: "applying" });

    let updated = 0;
    let notFound = 0;

    try {
      for (const match of file.matches) {
        if (!match.matchedItemId || match.extracted.price == null) {
          notFound++;
          continue;
        }

        // Find actual quantity from existing item
        const existingItem = existingItems.find(i => i.id === match.matchedItemId);
        const qty = existingItem?.quantity ?? null;
        const totalPrice = qty != null && match.extracted.price != null
          ? qty * match.extracted.price
          : null;

        await (supabase.from("material_statement_items" as any).update({
          price: match.extracted.price,
          total_price: totalPrice,
          source_file_id: file.id,
          price_source: "kp",
        }).eq("id", match.matchedItemId) as any);

        updated++;
      }

      updateFile(file.id, { status: "done" });
      // Persist done status to DB
      await (supabase.from("material_statements" as any).update({ classification_status: "done" }).eq("id", file.id) as any);
      queryClient.invalidateQueries({ queryKey: ["material-items"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-existing-items"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-files-history"] });

      toast({
        title: "Изменения применены",
        description: `Обновлено: ${updated}, Не найдено: ${notFound}`,
      });

      console.log(`[IncomingUploads] Applied: updated=${updated}, not_found=${notFound}, file="${file.fileName}"`);
    } catch (err: any) {
      console.error(`[IncomingUploads] Apply error:`, err.message);
      updateFile(file.id, { status: "error", error: err.message });
      toast({ title: "Ошибка применения", description: err.message, variant: "destructive" });
    }
  };

  // ── Re-process file — re-extract data from file ──
  const handleReprocess = async (file: IncomingFile) => {
    updateFile(file.id, { status: "recognizing", extractedRows: undefined, matches: undefined, error: undefined });

    try {
      let extractedRows: ExtractedRow[] = [];

      if (file.fileType === "xlsx") {
        // Re-fetch file and parse
        const response = await fetch(file.fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = (await import("xlsx")).read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = (await import("xlsx")).utils.sheet_to_json(sheet, { defval: "" });

        const cols = Object.keys(json[0] || {});
        const findCol = (patterns: string[]): string | null => {
          for (const col of cols) { const lc = col.toLowerCase(); for (const p of patterns) { if (lc.includes(p)) return col; } } return null;
        };
        const nameCol = findCol(["наименование", "название", "name", "материал", "товар", "позиция"]);
        const unitCol = findCol(["ед", "unit", "единица", "изм"]);
        const qtyCol = findCol(["кол", "quantity", "количество"]);
        const priceCol = findCol(["цена", "price", "стоимость за ед", "цена за ед"]);
        const totalCol = findCol(["сумма", "стоимость", "total", "итого", "всего"]);
        const parseNum = (val: any): number | null => {
          if (val === null || val === undefined || val === "") return null;
          if (typeof val === "number") return Number.isFinite(val) ? val : null;
          const s = String(val).replace(/\s/g, "").replace(",", ".");
          const n = Number(s);
          return Number.isFinite(n) ? n : null;
        };
        if (nameCol) {
          extractedRows = json
            .map(row => ({
              name: String(row[nameCol] || "").trim(),
              unit: unitCol ? (String(row[unitCol] || "").trim() || null) : null,
              quantity: qtyCol ? parseNum(row[qtyCol]) : null,
              price: priceCol ? parseNum(row[priceCol]) : null,
              total_price: totalCol ? parseNum(row[totalCol]) : null,
            }))
            .filter(r => r.name.length > 0);
        }
      } else {
        const { data: recData, error: recError } = await supabase.functions.invoke("recognize-materials", {
          body: { fileUrl: file.fileUrl, statementId: file.id, organizationId: orgId },
        });
        if (recError) throw recError;
        const materials = recData?.materials || [];
        extractedRows = materials.map((m: any) => ({
          name: m.name || "",
          unit: m.unit || null,
          quantity: m.quantity ?? null,
          price: null,
          total_price: null,
        }));
      }

      if (extractedRows.length === 0) {
        updateFile(file.id, { status: "error", error: "Не удалось извлечь строки из файла" });
        return;
      }

      // Re-match
      const matches: MatchResult[] = extractedRows.map(row => {
      const { item, score, matchType, matchDescription } = findBestMatch(row, existingItems);
      const matched = !!item;
      console.log(`[IncomingUploads] MATCH TYPE: ${matchType}`);
      return {
        extracted: row,
        matchedItemId: matched ? item!.id : null,
        matchedItemName: matched ? item!.name : null,
        oldPrice: matched ? item!.price : null,
        oldQuantity: matched ? item!.quantity : null,
        similarity: score,
        status: (matched ? "updated" : "not_found") as "updated" | "not_found",
        matchType,
        matchDescription,
      };
      });

      updateFile(file.id, { status: "ready", extractedRows, matches });
      toast({ title: "Перераспознано", description: `Извлечено ${extractedRows.length} строк` });
    } catch (err: any) {
      updateFile(file.id, { status: "error", error: err.message });
      toast({ title: "Ошибка перераспознавания", description: err.message, variant: "destructive" });
    }
  };

  // ── Manual section assignment ──
  const handleManualAssign = async () => {
    if (!manualSectionDialog || !manualSectionId) return;
    const file = manualSectionDialog;
    const section = sections.find(s => s.id === manualSectionId);
    const targetFolder = folders.find(f => f.section_id === manualSectionId && f.type === "materials");

    if (!targetFolder) {
      toast({ title: "Папка не найдена", variant: "destructive" });
      return;
    }

    // Update file section info and re-match
    const matches = (file.extractedRows || []).map(row => {
        const { item, score, matchType, matchDescription } = findBestMatch(row, existingItems);
        const matched = !!item;
        console.log(`[IncomingUploads] MATCH TYPE: ${matchType}`);
        return {
          extracted: row,
          matchedItemId: matched ? item!.id : null,
          matchedItemName: matched ? item!.name : null,
          oldPrice: matched ? item!.price : null,
          oldQuantity: matched ? item!.quantity : null,
          similarity: score,
          status: (matched ? "updated" : "not_found") as "updated" | "not_found",
          matchType,
          matchDescription,
        };
    });

    // Update DB
    await (supabase.from("material_statements" as any).update({
      folder_id: targetFolder.id,
      section_id: manualSectionId,
      classification_status: "classified",
    }).eq("id", file.id) as any);

    updateFile(file.id, {
      status: "ready",
      sectionId: manualSectionId,
      sectionName: section?.name || null,
      folderId: targetFolder.id,
      matches,
    });

    setManualSectionDialog(null);
    setManualSectionId("");
  };

  const handleFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => processFile(file));
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [orgId, objectId, year, existingItems]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIncomingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const [selectedIncomingIds, setSelectedIncomingIds] = useState<Set<string>>(new Set());
  const toggleIncomingSelection = (id: string) => {
    setSelectedIncomingIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAllIncoming = () => {
    if (selectedIncomingIds.size === files.length) setSelectedIncomingIds(new Set());
    else setSelectedIncomingIds(new Set(files.map(f => f.id)));
  };
  const handleBulkDeleteIncoming = () => {
    setFiles(prev => prev.filter(f => !selectedIncomingIds.has(f.id)));
    setSelectedIncomingIds(new Set());
  };

  const hasActiveFiles = files.length > 0;

  // Stats and filtered matches for review dialog
  const reviewMatches = reviewFile?.matches || [];
  const filteredReviewMatches = useMemo(() => {
    if (!reviewSearch.trim()) return reviewMatches;
    return reviewMatches.filter(m =>
      matchesMaterialSearch(reviewSearch, m.extracted.name, m.extracted.unit, m.matchedItemName)
    );
  }, [reviewMatches, reviewSearch]);
  const updatedCount = reviewMatches.filter(m => m.matchedItemId && m.extracted.price != null).length;
  const notFoundCount = reviewMatches.filter(m => !m.matchedItemId).length;
  const noPriceCount = reviewMatches.filter(m => m.matchedItemId && m.extracted.price == null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{objectName}</h1>
        <p className="text-sm text-muted-foreground">
          {year} год — <span className="font-medium text-foreground">Входящие</span>
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <div className={cn("p-3 rounded-full transition-colors", isDragOver ? "bg-primary/10" : "bg-muted")}>
          <Upload className={cn("h-8 w-8 transition-colors", isDragOver ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="text-center">
          <p className="text-base font-medium">
            {isDragOver ? "Отпустите файлы для загрузки" : "Перетащите файлы сюда"}
          </p>
          <p className="text-sm text-muted-foreground">
            или нажмите для выбора · PDF, Excel
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Файлы будут распознаны → сопоставлены с материалами → обновлены цены
          </p>
        </div>
      </div>

      {/* Files Status Table */}
      {hasActiveFiles && (
        <Card>
          <CardHeader className="py-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Загруженные файлы ({files.length})
            </CardTitle>
            {selectedIncomingIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Выбрано: {selectedIncomingIds.size}</span>
                <Button size="sm" variant="destructive" onClick={handleBulkDeleteIncoming}>
                  <Trash2 className="h-4 w-4 mr-1" /> Удалить ({selectedIncomingIds.size})
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={files.length > 0 && selectedIncomingIds.size === files.length} onCheckedChange={toggleSelectAllIncoming} />
                  </TableHead>
                  <TableHead>Файл</TableHead>
                  <TableHead>Извлечено строк</TableHead>
                  <TableHead>Раздел</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[220px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const statusConfig = STATUS_CONFIG[file.status];
                  const matchedCount = file.matches?.filter(m => m.matchedItemId).length || 0;
                  const totalExtracted = file.extractedRows?.length || 0;

                  return (
                    <TableRow key={file.id}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIncomingIds.has(file.id)} onCheckedChange={() => toggleIncomingSelection(file.id)} />
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        {file.fileType === "pdf" ? (
                          <FileText className="h-4 w-4 text-destructive flex-shrink-0" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        <div className="truncate max-w-[300px]">
                          <span>{file.fileName}</span>
                          {file.error && (
                            <p className="text-xs text-destructive truncate">{file.error}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {totalExtracted > 0 ? (
                          <span className="text-sm">
                            {totalExtracted} строк
                            {matchedCount > 0 && (
                              <span className="text-muted-foreground ml-1">
                                ({matchedCount} совпадений)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {file.sectionName ? (
                          <span className="font-medium">{file.sectionName}</span>
                        ) : file.status === "ready" ? (
                          <span className="text-muted-foreground italic">Не определён</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig?.variant || "secondary"} className="gap-1">
                          {statusConfig?.icon}
                          {statusConfig?.label || file.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {file.status === "ready" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => { setReviewFile(file); setReviewSearch(""); }}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" /> Просмотр
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReprocess(file)}
                                title="Перераспознать"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              {!file.sectionName && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setManualSectionDialog(file);
                                    setManualSectionId("");
                                  }}
                                >
                                  <MoveRight className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                          {file.status === "done" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setReviewFile(file); setReviewSearch(""); }}>
                                <ArrowRight className="h-3 w-3 mr-1" /> Просмотр
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReprocess(file)}
                                title="Перераспознать"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => removeFile(file.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {file.status === "error" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReprocess(file)}
                                title="Перераспознать"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" /> Повторить
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFile(file.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!hasActiveFiles && (
        <div className="text-center text-muted-foreground py-8 space-y-2">
          <p className="text-sm">Загрузите файлы — система автоматически:</p>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" /> Извлечёт данные
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" /> Определит раздел
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ArrowRight className="h-3 w-3" /> Сопоставит материалы
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3" /> Обновит цены
            </Badge>
          </div>
        </div>
      )}

      {/* ── Review Dialog — shows extracted rows matched against existing materials ── */}
      <Dialog open={!!reviewFile} onOpenChange={(open) => { if (!open) setReviewFile(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Результат распознавания
              <span className="text-sm font-normal text-muted-foreground">— {reviewFile?.fileName}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Stats */}
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="gap-1">
              Всего: {reviewMatches.length}
            </Badge>
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" /> Обновлено: {updatedCount}
            </Badge>
            <Badge variant="destructive" className="gap-1">
              <X className="h-3 w-3" /> Не найдено: {notFoundCount}
            </Badge>
            {noPriceCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                Без цены: {noPriceCount}
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="🔎 Найти материал..."
              value={reviewSearch}
              onChange={e => setReviewSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Материал (из файла)</TableHead>
                  <TableHead>Ед.</TableHead>
                  <TableHead className="text-right">Новая цена</TableHead>
                  <TableHead>Найден в системе</TableHead>
                  <TableHead className="text-right">Текущая цена</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviewMatches.map((match, idx) => (
                  <TableRow
                    key={idx}
                    className={cn(
                      match.status === "updated" && match.extracted.price != null && "bg-primary/5",
                      match.status === "not_found" && "bg-destructive/5"
                    )}
                  >
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      <HighlightText text={match.extracted.name} searchQuery={reviewSearch} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{match.extracted.unit || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {match.extracted.price != null ? match.extracted.price.toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {match.matchedItemName ? (
                        <HighlightText text={match.matchedItemName} searchQuery={reviewSearch} />
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {match.oldPrice != null ? match.oldPrice.toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell>
                      {match.status === "updated" && match.extracted.price != null ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="default" className="text-xs">обновлено</Badge>
                          {match.matchType === "parametric" && (
                            <span className="text-[10px] text-muted-foreground">
                              {`MATCH TYPE: parametric`}
                            </span>
                          )}
                          {match.matchType === "parametric" && (
                            <span className="text-[10px] text-muted-foreground">
                              {`Совпадение по параметрам (игнорируя ГОСТ)${match.matchDescription ? ` (${match.matchDescription})` : ""}`}
                            </span>
                          )}
                        </div>
                      ) : match.status === "not_found" ? (
                        <Badge variant="destructive" className="text-xs">не найден</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">без цены</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReviewMatches.length === 0 && reviewSearch && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Ничего не найдено по запросу «{reviewSearch}»
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFile(null)}>Закрыть</Button>
            <Button
              onClick={() => {
                if (reviewFile) {
                  handleApplyChanges(reviewFile);
                  setReviewFile(null);
                }
              }}
              disabled={updatedCount === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Применить изменения ({updatedCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Section Assignment Dialog ── */}
      <Dialog open={!!manualSectionDialog} onOpenChange={(open) => { if (!open) setManualSectionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выберите раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Файл: <strong>{manualSectionDialog?.fileName}</strong>
            </p>
            <div>
              <label className="text-sm font-medium">Раздел</label>
              <Select value={manualSectionId} onValueChange={setManualSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent>
                  {objectSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {objectSections.length === 0 && (
              <p className="text-sm text-destructive">Нет разделов. Сначала создайте раздел.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualSectionDialog(null)}>Отмена</Button>
            <Button onClick={handleManualAssign} disabled={!manualSectionId}>
              <MoveRight className="h-4 w-4 mr-1" /> Распределить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
