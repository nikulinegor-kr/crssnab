import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, FileText, DollarSign, Building2, Loader2, Upload, RefreshCw, Download, ExternalLink, Wand2, ArrowUpDown, ZoomIn, ZoomOut, BookUser } from "lucide-react";
import { formatCompanyName } from "@/lib/companyFormat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";

import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useDadataSearch, DadataSuggestion } from "@/hooks/useDadataSearch";
import { SupplierListsDialog } from "@/components/materials/SupplierListsDialog";
import { PhoneBookImportDialog } from "@/components/suppliers/PhoneBookImportDialog";

const InlineNomenclatureCell = ({ supplierId, value }: { supplierId: string; value: string | null }) => {
  const [text, setText] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setText(value || ""); }, [value]);

  const save = async () => {
    const next = text.trim();
    if (next === (value || "")) return;
    setSaving(true);
    const { error } = await supabase.from("suppliers").update({ nomenclature: next || null }).eq("id", supplierId);
    setSaving(false);
    if (error) {
      toast({ title: "Ошибка", description: "Не удалось сохранить номенклатуру", variant: "destructive" });
      setText(value || "");
    } else {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  };

  return (
    <div className="relative px-1">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setText(value || "");
        }}
        placeholder="—"
        className="h-7 border-transparent bg-transparent hover:border-input focus:border-input text-center text-sm px-2"
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
    </div>
  );
};

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  status: string;
  reliability: string;
  address: string | null;
  city: string | null;
  nomenclature: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bik: string | null;
  notes: string | null;
  created_at: string;
  organization_id: string;
}

const reliabilities = ["Надёжный", "На проверке", "Не проверен", "Риск", "Заблокирован"];

const categories = ["Запасные части", "Материалы", "Услуги", "Оборудование", "Другое"];
const statuses = ["Активный", "В ожидании", "Неактивный"];

export default function Suppliers() {
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [tableZoom, setTableZoom] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isPhoneBookOpen, setIsPhoneBookOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    category: "Другое",
    status: "Активный",
    reliability: "Не проверен",
    address: "",
    city: "",
    nomenclature: "",
    inn: "",
    kpp: "",
    ogrn: "",
    bank_name: "",
    bank_account: "",
    bik: "",
    notes: "",
  });

  const [isExtractingSupplier, setIsExtractingSupplier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { suggestions, isSearching, search: searchDadata, clearSuggestions } = useDadataSearch();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dadataQuery, setDadataQuery] = useState("");
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Получаем все заявки (включая архивные) для статистики контрагентов
  const { data: allRequests } = useQuery({
    queryKey: ["all-requests-for-suppliers", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("contractor, amount")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  // Статистика по контрагентам
  const contractorStats = useMemo(() => {
    if (!allRequests) return new Map<string, { count: number; totalAmount: number }>();
    const map = new Map<string, { count: number; totalAmount: number }>();
    allRequests.forEach(r => {
      if (!r.contractor) return;
      const key = r.contractor.toLowerCase().trim();
      const prev = map.get(key) || { count: 0, totalAmount: 0 };
      prev.count++;
      prev.totalAmount += r.amount || 0;
      map.set(key, prev);
    });
    return map;
  }, [allRequests]);

  // Получаем поставщиков
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers", currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!currentOrgId,
  });

  // Создание/обновление поставщика
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(data)
          .eq("id", editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert([{ ...data, organization_id: currentOrgId, created_by: user.user?.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({
        title: editingSupplier ? "Поставщик обновлен" : "Поставщик создан",
        description: editingSupplier 
          ? "Данные поставщика успешно обновлены"
          : "Новый поставщик успешно добавлен",
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось ${editingSupplier ? "обновить" : "создать"} поставщика: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Удаление поставщика
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({
        title: "Поставщик удален",
        description: "Поставщик успешно удален из системы",
      });
    },
  });

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        category: supplier.category,
        status: supplier.status,
        reliability: supplier.reliability || "Не проверен",
        address: supplier.address || "",
        city: supplier.city || "",
        nomenclature: supplier.nomenclature || "",
        inn: supplier.inn || "",
        kpp: supplier.kpp || "",
        ogrn: supplier.ogrn || "",
        bank_name: supplier.bank_name || "",
        bank_account: supplier.bank_account || "",
        bik: supplier.bik || "",
        notes: supplier.notes || "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      category: "Другое",
      status: "Активный",
      reliability: "Не проверен",
      address: "",
      city: "",
      nomenclature: "",
      inn: "",
      kpp: "",
      ogrn: "",
      bank_name: "",
      bank_account: "",
      bik: "",
      notes: "",
    });
    setDadataQuery("");
    clearSuggestions();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...formData, name: formatCompanyName(formData.name) });
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingSupplier(true);

    try {
      // Convert file to base64 data URL
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-supplier", {
        body: { file: base64, fileName: file.name, fileType: file.type },
      });

      if (error) throw error;

      const supplier = data?.supplier;
      if (!supplier || !supplier.inn) {
        toast({
          title: "Не удалось извлечь данные",
          description: "Не найдены реквизиты поставщика в документе. Попробуйте другой файл.",
          variant: "destructive",
        });
        return;
      }

      // Check if supplier with this INN already exists
      if (currentOrgId && supplier.inn) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("organization_id", currentOrgId)
          .eq("inn", supplier.inn)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Поставщик найден",
            description: `Поставщик "${existing.name}" (ИНН: ${supplier.inn}) уже есть в базе`,
          });
          return;
        }
      }

      // Fill the form with extracted data
      setFormData((prev) => ({
        ...prev,
        name: supplier.name || prev.name,
        inn: supplier.inn || prev.inn,
        kpp: supplier.kpp || prev.kpp,
        ogrn: supplier.ogrn || prev.ogrn,
        bank_name: supplier.bank_name || prev.bank_name,
        bank_account: supplier.bank_account || prev.bank_account,
        bik: supplier.bik || prev.bik,
        address: supplier.address || prev.address,
        phone: supplier.phone || prev.phone,
        email: supplier.email || prev.email,
        contact_person: supplier.contact_person || prev.contact_person,
      }));

      setIsDialogOpen(true);

      toast({
        title: "Данные извлечены",
        description: `Реквизиты "${supplier.name}" заполнены из документа. Проверьте и сохраните.`,
      });
    } catch (err: any) {
      console.error("Extract supplier error:", err);
      toast({
        title: "Ошибка распознавания",
        description: err.message || "Не удалось обработать документ",
        variant: "destructive",
      });
    } finally {
      setIsExtractingSupplier(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [isBatchEnriching, setIsBatchEnriching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const handleBatchEnrich = async () => {
    if (!suppliers || !currentOrgId) return;

    const toEnrich = suppliers.filter(
      (s) => !s.inn || !s.kpp
    );

    if (toEnrich.length === 0) {
      toast({
        title: "Все поставщики заполнены",
        description: "Нет поставщиков с пустым ИНН или КПП",
      });
      return;
    }

    setIsBatchEnriching(true);
    setBatchProgress({ current: 0, total: toEnrich.length });
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const supplier = toEnrich[i];
      setBatchProgress({ current: i + 1, total: toEnrich.length });

      try {
        const { data, error } = await supabase.functions.invoke("dadata-lookup", {
          body: { query: supplier.name, count: 1 },
        });

        if (error || !data?.suggestions?.length) {
          failed++;
          continue;
        }

        const s = data.suggestions[0];
        const updateData: Record<string, string> = {};

        if (!supplier.inn && s.inn) updateData.inn = s.inn;
        if (!supplier.kpp && s.kpp) updateData.kpp = s.kpp;
        if (s.ogrn && !supplier.ogrn) updateData.ogrn = s.ogrn;
        if (s.address && !supplier.address) updateData.address = s.address;
        if (s.management_name && !supplier.contact_person) updateData.contact_person = s.management_name;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("suppliers")
            .update(updateData)
            .eq("id", supplier.id);

          if (updateError) {
            failed++;
          } else {
            updated++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        failed++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    setIsBatchEnriching(false);

    toast({
      title: "Обновление завершено",
      description: `Обновлено: ${updated}, не найдено: ${failed}, всего обработано: ${toEnrich.length}`,
    });
  };

  const normalizeDuplicateKey = (name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/['"«»“”]/g, "")
      .replace(/\b(ооо|ао|пао|зао|ип|общество с ограниченной ответственностью|акционерное общество)\b/g, "")
      .trim();

  const duplicateGroups = useMemo(() => {
    if (!suppliers) return [] as Supplier[][];
    const map = new Map<string, Supplier[]>();
    for (const s of suppliers) {
      const key = normalizeDuplicateKey(s.name);
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [suppliers]);

  const duplicateIds = useMemo(
    () => new Set(duplicateGroups.flatMap((g) => g.map((s) => s.id))),
    [duplicateGroups]
  );

  const filteredSuppliers = suppliers
    ?.filter((supplier) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return q.split(/\s+/).every((term) =>
        [supplier.name, supplier.contact_person, supplier.email, supplier.city, supplier.nomenclature, supplier.inn]
          .some((v) => v?.toLowerCase().includes(term))
      );
    })
    .sort((a, b) =>
      sortDirection === "asc"
        ? a.name.localeCompare(b.name, "ru-RU")
        : b.name.localeCompare(a.name, "ru-RU")
    );

  const handleExportExcel = async () => {
    const rows = filteredSuppliers || [];
    if (!rows.length) {
      toast({ title: "Нет данных для экспорта", variant: "destructive" });
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const data = rows.map((s) => {
        const stats = contractorStats.get(s.name.toLowerCase().trim());
        return {
          "Название": s.name,
          "Город": s.city || "",
          "Номенклатура": s.nomenclature || "",
          "ИНН": s.inn || "",
          "КПП": s.kpp || "",
          "ОГРН": s.ogrn || "",
          "Контактное лицо": s.contact_person || "",
          "Телефон": s.phone || "",
          "Email": s.email || "",
          "Категория": s.category || "",
          "Статус": s.status || "",
          "Благонадёжность": s.reliability || "",
          "Адрес": s.address || "",
          "Банк": s.bank_name || "",
          "Расчётный счёт": s.bank_account || "",
          "БИК": s.bik || "",
          "Заявок": stats?.count || 0,
          "Сумма закупок": stats?.totalAmount || 0,
          "Примечания": s.notes || "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 26 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Поставщики");
      XLSX.writeFile(wb, `поставщики_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast({ title: "Экспорт завершён", description: `Выгружено поставщиков: ${rows.length}` });
    } catch (e: any) {
      toast({ title: "Ошибка экспорта", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const [isFormatting, setIsFormatting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportExcel = async (file: File) => {
    if (!currentOrgId) {
      toast({ title: "Организация не выбрана", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const norm = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
      const lc = (v: any) => norm(v).toLowerCase();

      const existing = new Set((suppliers || []).map((s) => lc(s.name)));
      const rows: any[] = [];
      const seen = new Set<string>();

      for (const sheetName of wb.SheetNames) {
        const raw: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
        if (!raw.length) continue;

        const KEYS = ["назв", "поставщик", "организац", "компани", "инн", "кпп", "огрн", "телеф", "email", "почт", "город", "адрес", "номенклат", "контакт", "банк", "бик"];
        let headerIdx = -1;
        let best = 0;
        for (let i = 0; i < Math.min(raw.length, 25); i++) {
          const joined = raw[i].map(lc).join("|");
          const hits = KEYS.reduce((n, k) => n + (joined.includes(k) ? 1 : 0), 0);
          if (hits > best) { best = hits; headerIdx = i; }
        }
        if (headerIdx < 0 || best < 1) continue;

        const headers = raw[headerIdx].map(lc);
        const col = (...keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
        const cName = col("назв", "поставщик", "организац", "компани", "контрагент");
        const cCity = col("город", "регион");
        const cNom = col("номенклат", "товар", "продук", "что постав");
        const cInn = col("инн");
        const cKpp = col("кпп");
        const cOgrn = col("огрн");
        const cContact = col("контакт", "фио", "менеджер", "представит");
        const cPhone = col("телеф", "тел", "phone", "моб");
        const cEmail = col("email", "почт", "e-mail", "мейл");
        const cAddr = col("адрес");
        const cBank = col("банк");
        const cAcc = col("счет", "счёт", "р/с");
        const cBik = col("бик");
        const cCat = col("категор");
        const cNote = col("примеч", "коммент");
        if (cName < 0) continue;

        for (let i = headerIdx + 1; i < raw.length; i++) {
          const cells = raw[i].map(norm);
          const rawName = cells[cName];
          if (!rawName) continue;
          const name = formatCompanyName(rawName);
          const key = lc(name);
          if (!key || existing.has(key) || seen.has(key)) continue;
          seen.add(key);
          const pick = (idx: number) => (idx >= 0 && cells[idx] ? cells[idx] : null);
          rows.push({
            organization_id: currentOrgId,
            name,
            city: pick(cCity),
            nomenclature: pick(cNom),
            inn: pick(cInn),
            kpp: pick(cKpp),
            ogrn: pick(cOgrn),
            contact_person: pick(cContact),
            phone: pick(cPhone),
            email: pick(cEmail),
            address: pick(cAddr),
            bank_name: pick(cBank),
            bank_account: pick(cAcc),
            bik: pick(cBik),
            category: pick(cCat) || "Другое",
            status: "Активный",
            reliability: "Не проверен",
            notes: pick(cNote),
          });
        }
      }

      if (!rows.length) {
        toast({
          title: "Не удалось распознать данные",
          description: "Нужна строка-заголовок со столбцом «Название» (или «Поставщик»)",
          variant: "destructive",
        });
        return;
      }

      const { data: authUser } = await supabase.auth.getUser();
      const createdBy = authUser?.user?.id;
      if (!createdBy) throw new Error("Не удалось определить пользователя");

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase
          .from("suppliers")
          .insert(rows.slice(i, i + 200).map((r) => ({ ...r, created_by: createdBy })));
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Импорт завершён", description: `Добавлено поставщиков: ${rows.length}` });
    } catch (e: any) {
      toast({ title: "Ошибка импорта", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };


  const handleNormalizeNames = async () => {
    if (!suppliers?.length) return;
    setIsFormatting(true);
    let changed = 0;
    for (const s of suppliers) {
      const next = formatCompanyName(s.name);
      if (next && next !== s.name) {
        const { error } = await supabase.from("suppliers").update({ name: next }).eq("id", s.id);
        if (!error) changed++;
      }
    }
    setIsFormatting(false);
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    toast({ title: "Формат названий обновлён", description: `Изменено записей: ${changed}` });
  };


  const handleMergeGroup = async (group: Supplier[]) => {
    if (!currentOrgId || group.length < 2) return;
    setIsMerging(true);
    try {
      // Choose primary: more filled fields, then more requests, then earliest created
      const score = (s: Supplier) => {
        let points = 0;
        if (s.inn) points += 3;
        if (s.phone) points += 2;
        if (s.email) points += 1;
        if (s.city) points += 1;
        if (s.nomenclature) points += 1;
        const stats = contractorStats.get(s.name.toLowerCase().trim());
        points += (stats?.count || 0) * 2;
        return points;
      };
      const sorted = [...group].sort((a, b) => {
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      const [primary, ...duplicates] = sorted;

      for (const dup of duplicates) {
        // Update requests contractor names
        const { error: reqErr } = await supabase
          .from("requests")
          .update({ contractor: primary.name })
          .eq("organization_id", currentOrgId)
          .eq("contractor", dup.name);
        if (reqErr) throw reqErr;
        // Delete duplicate (will fail if still referenced elsewhere)
        const { error: delErr } = await supabase.from("suppliers").delete().eq("id", dup.id);
        if (delErr) throw delErr;
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["contractor-stats"] });
      toast({
        title: "Дубли объединены",
        description: `Сохранён «${primary.name}», удалено дублей: ${duplicates.length}`,
      });
    } catch (e: any) {
      toast({ title: "Ошибка объединения", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsMerging(false);
    }
  };


  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Заголовок */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Поставщики</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Управление базой данных поставщиков
              </p>
            </div>
            <div className="flex gap-2">
              {currentOrgId && (
                <SupplierListsDialog
                  objectName="Общая"
                  organizationId={currentOrgId}
                />
              )}
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Новый поставщик
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={isExtractingSupplier}
                onClick={() => fileInputRef.current?.click()}
              >
                {isExtractingSupplier ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isExtractingSupplier ? "Распознаём..." : "Из счёта"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleInvoiceUpload}
              />
              <Button
                variant="outline"
                className="gap-2"
                disabled={isBatchEnriching}
                onClick={handleBatchEnrich}
              >
                {isBatchEnriching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isBatchEnriching
                  ? `Обновляем ${batchProgress.current}/${batchProgress.total}...`
                  : "Заполнить реквизиты"}
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
                <Download className="h-4 w-4" />
                Экспорт Excel
              </Button>
              <Button variant="outline" className="gap-2" asChild disabled={isImporting}>
                <label className="cursor-pointer">
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isImporting ? "Импорт..." : "Импорт Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportExcel(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>

              <Button variant="outline" className="gap-2" disabled={isFormatting} onClick={handleNormalizeNames}>
                {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Формат названий
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={duplicateGroups.length === 0}
                onClick={() => setIsMergeDialogOpen(true)}
              >
                <Building2 className="h-4 w-4" />
                Дубли {duplicateGroups.length > 0 && `(${duplicateGroups.length})`}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setIsPhoneBookOpen(true)}>
                <BookUser className="h-4 w-4" />
                Телефоны из контактов
              </Button>
            </div>
          </div>

          {/* Поиск и фильтры */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по поставщикам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortDirection === "asc" ? "А → Я" : "Я → А"}
            </Button>
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setTableZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-medium min-w-[3ch] text-center">{Math.round(tableZoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setTableZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(1)))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Фильтры
            </Button>
          </div>
        </div>

          {/* Таблица поставщиков */}
          <div className="overflow-x-auto">
            <Card className="bg-card border-border/40" style={{ transform: `scale(${tableZoom})`, transformOrigin: "top left" }}>
            <CardHeader className="border-b border-border/40 overflow-x-auto">
              <div className="min-w-[980px] grid grid-cols-[2fr_1fr_1.4fr_0.9fr_1.6fr_0.7fr_1.1fr_auto] text-xs font-medium text-muted-foreground uppercase">
                <div className="border-r border-border/40 px-3 py-2 text-left">Название</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">Город</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">Номенклатура</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">ИНН</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">Телефон / Email</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">Заявки</div>
                <div className="border-r border-border/40 px-3 py-2 text-center">Сумма закупок</div>
                <div className="px-3 py-2 text-right">Действия</div>
              </div>
            </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Загрузка...
              </div>
            ) : filteredSuppliers && filteredSuppliers.length > 0 ? (
              <div className="divide-y divide-border/40 min-w-[1180px]">
                 {filteredSuppliers.map((supplier, index) => {
                    const stats = contractorStats.get(supplier.name.toLowerCase().trim());
                    return (
                    <div
                      key={supplier.id}
                      className={cn(
                        "grid grid-cols-[2fr_1fr_1.4fr_0.9fr_1.6fr_0.7fr_1.1fr_auto] hover:bg-muted/30 transition-colors items-center",
                        index % 2 === 1 && "bg-muted/20",
                        duplicateIds.has(supplier.id) && "bg-amber-500/5"
                      )}
                    >
                      <div className="min-w-0 border-r border-border/40 px-3 py-4 text-left">
                        <button
                          type="button"
                          className="font-medium text-foreground text-left hover:text-primary hover:underline inline-flex items-center gap-1"
                          title="Открыть заявки этого поставщика"
                          onClick={() => navigate(`/requests?contractor=${encodeURIComponent(supplier.name)}`)}
                        >
                          <span className="truncate">{supplier.name}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                        </button>
                        {supplier.contact_person && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{supplier.contact_person}</div>
                        )}
                      </div>
                      <div className="border-r border-border/40 px-3 py-4 text-center text-sm text-muted-foreground truncate">{supplier.city || "—"}</div>
                      <div className="border-r border-border/40 px-3 py-4 text-center text-sm text-muted-foreground truncate" title={supplier.nomenclature || ""}>
                        {supplier.nomenclature || "—"}
                      </div>
                      <div className="border-r border-border/40 px-3 py-4 text-center text-sm text-muted-foreground font-mono">
                        {supplier.inn || "—"}
                      </div>
                      <div className="border-r border-border/40 px-3 py-4 text-center text-sm text-muted-foreground min-w-0">
                        <div className="truncate">{supplier.phone || "—"}</div>
                        {supplier.email && <div className="text-xs truncate">{supplier.email}</div>}
                      </div>
                      <div className="border-r border-border/40 px-3 py-4 text-center">
                        {stats?.count ? (
                          <Badge variant="secondary" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {stats.count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                      <div className="border-r border-border/40 px-3 py-4 text-center text-sm font-medium">
                        {stats?.totalAmount ? (
                          <span className="text-foreground">
                            {stats.totalAmount.toLocaleString("ru-RU")} ₽
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                      <div className="px-3 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(supplier)}>
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/requests?contractor=${encodeURIComponent(supplier.name)}`)}>
                              Все заявки поставщика
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(supplier.id)}
                              className="text-destructive"
                            >
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? "Поставщики не найдены" : "Нет поставщиков"}
              </div>
            )}
            </CardContent>
          </Card>
          </div>

        {/* Диалог создания/редактирования */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Редактировать поставщика" : "Новый поставщик"}
              </DialogTitle>
              <DialogDescription>
                Заполните информацию о поставщике
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* DaData search */}
              <div className="space-y-2 relative">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Поиск по ИНН или названию
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Введите ИНН или название компании..."
                    value={dadataQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDadataQuery(v);
                      searchDadata(v);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="pl-9 pr-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        type="button"
                        key={`${s.inn}-${i}`}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border/40 last:border-b-0"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            name: s.name,
                            inn: s.inn,
                            kpp: s.kpp,
                            ogrn: s.ogrn,
                            address: s.address,
                            contact_person: s.management_name || prev.contact_person,
                          }));
                          setDadataQuery(s.name);
                          setShowSuggestions(false);
                          clearSuggestions();
                        }}
                      >
                        <div className="font-medium text-sm text-foreground">{s.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          ИНН: {s.inn}{s.kpp ? ` / КПП: ${s.kpp}` : ""}{s.ogrn ? ` / ОГРН: ${s.ogrn}` : ""}
                        </div>
                        {s.address && (
                          <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.address}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название компании *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Контактное лицо</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Категория *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Статус *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reliability">Благонадёжность</Label>
                <Select
                  value={formData.reliability}
                  onValueChange={(value) => setFormData({ ...formData, reliability: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reliabilities.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input
                    id="inn"
                    value={formData.inn}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kpp">КПП</Label>
                  <Input
                    id="kpp"
                    value={formData.kpp}
                    onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ogrn">ОГРН</Label>
                  <Input
                    id="ogrn"
                    value={formData.ogrn}
                    onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Город</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Например: Новосибирск"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomenclature">Номенклатура</Label>
                  <Input
                    id="nomenclature"
                    value={formData.nomenclature}
                    onChange={(e) => setFormData({ ...formData, nomenclature: e.target.value })}
                    placeholder="Что поставляет: фильтры, метизы, ГСМ…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Юридический адрес</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Банк</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account">Расчётный счёт</Label>
                  <Input
                    id="bank_account"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bik">БИК</Label>
                  <Input
                    id="bik"
                    value={formData.bik}
                    onChange={(e) => setFormData({ ...formData, bik: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Примечания</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Отменить
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Сохранение..." : editingSupplier ? "Обновить" : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Дублирующиеся поставщики</DialogTitle>
              <DialogDescription>
                Найдено {duplicateGroups.length} групп дублей. Для каждой группы выберите основную запись — заявки и связи будут перенесены, остальные удалены.
              </DialogDescription>
            </DialogHeader>

            {duplicateGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Дубли не найдены</div>
            ) : (
              <div className="space-y-4">
                {duplicateGroups.map((group, idx) => (
                  <div key={idx} className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="text-sm font-medium text-foreground">Группа {idx + 1}</div>
                    <div className="space-y-2">
                      {group.map((s) => {
                        const stats = contractorStats.get(s.name.toLowerCase().trim());
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md bg-muted/30"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{s.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {s.inn ? `ИНН ${s.inn}` : "без ИНН"} • {s.city || "—"} • {s.nomenclature || "—"}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {stats?.count ? (
                                <Badge variant="secondary" className="gap-1">
                                  <FileText className="h-3 w-3" />
                                  {stats.count}
                                </Badge>
                              ) : null}
                              {stats?.totalAmount ? (
                                <span className="text-xs text-muted-foreground">
                                  {stats.totalAmount.toLocaleString("ru-RU")} ₽
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMergeGroup(group)}
                      disabled={isMerging}
                    >
                      {isMerging ? "Объединение..." : "Объединить группу"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <PhoneBookImportDialog
          open={isPhoneBookOpen}
          onOpenChange={setIsPhoneBookOpen}
          suppliers={(suppliers || []).map((s) => ({ id: s.id, name: s.name, phone: s.phone }))}
        />
      </div>
    </div>
  );
}
