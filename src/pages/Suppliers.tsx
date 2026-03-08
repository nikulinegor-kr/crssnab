import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, FileText, DollarSign, Building2, Loader2, Upload, RefreshCw } from "lucide-react";
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

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  status: string;
  address: string | null;
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

const categories = ["Запасные части", "Материалы", "Услуги", "Оборудование", "Другое"];
const statuses = ["Активный", "В ожидании", "Неактивный"];

export default function Suppliers() {
  const navigate = useNavigate();
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    category: "Другое",
    status: "Активный",
    address: "",
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
        address: supplier.address || "",
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
      address: "",
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
    mutation.mutate(formData);
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

  const filteredSuppliers = suppliers?.filter((supplier) =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Активный": return "bg-success/20 text-success";
      case "В ожидании": return "bg-warning/20 text-warning";
      case "Неактивный": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
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
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Фильтры
            </Button>
          </div>
        </div>

        {/* Таблица поставщиков */}
        <Card className="bg-card border-border/40">
          <CardHeader className="border-b border-border/40">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground uppercase">
              <div className="col-span-2">Название</div>
              <div className="col-span-1">ИНН</div>
              <div className="col-span-2">Телефон / Email</div>
              <div className="col-span-1">Категория</div>
              <div className="col-span-1">Статус</div>
              <div className="col-span-1 text-center">Заявки</div>
              <div className="col-span-2 text-right">Сумма закупок</div>
              <div className="col-span-2 text-right">Действия</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Загрузка...
              </div>
            ) : filteredSuppliers && filteredSuppliers.length > 0 ? (
              <div className="divide-y divide-border/40">
                 {filteredSuppliers.map((supplier) => {
                    const stats = contractorStats.get(supplier.name.toLowerCase().trim());
                    return (
                    <div
                      key={supplier.id}
                      className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/30 transition-colors items-center"
                    >
                      <div className="col-span-2">
                        <div className="font-medium text-foreground">{supplier.name}</div>
                        {supplier.contact_person && (
                          <div className="text-xs text-muted-foreground mt-0.5">{supplier.contact_person}</div>
                        )}
                      </div>
                      <div className="col-span-1 text-sm text-muted-foreground font-mono">
                        {supplier.inn || "—"}
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">
                        <div>{supplier.phone || "—"}</div>
                        {supplier.email && <div className="text-xs truncate">{supplier.email}</div>}
                      </div>
                      <div className="col-span-1">
                        <Badge variant="outline" className="font-normal text-xs">
                          {supplier.category}
                        </Badge>
                      </div>
                      <div className="col-span-1">
                        <Badge className={getStatusColor(supplier.status)}>
                          {supplier.status}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        {stats?.count ? (
                          <Badge variant="secondary" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {stats.count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right text-sm font-medium">
                        {stats?.totalAmount ? (
                          <span className="text-foreground">
                            {stats.totalAmount.toLocaleString("ru-RU")} ₽
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
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
      </div>
    </div>
  );
}
