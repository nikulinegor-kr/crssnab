import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, Trash2, Download, Loader2, FileSpreadsheet, Upload, Pencil } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  objectId?: string | null;
  objectName: string;
  organizationId: string;
  trigger?: React.ReactNode;
  initialListId?: string | null;
  openInitially?: boolean;
  onClose?: () => void;
}

interface ListRow {
  id: string;
  name: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  list_id: string;
  organization_id: string;
  region: string;
  position: number;
  website_url: string | null;
  supplier_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  note: string | null;
  extraction_failed: boolean | null;
}


export const SupplierListsDialog = ({ objectId, objectName, organizationId, trigger, initialListId, openInitially, onClose }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!openInitially);
  const [selectedListId, setSelectedListId] = useState<string | null>(initialListId ?? null);
  const [creatingName, setCreatingName] = useState("");
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [newRegion, setNewRegion] = useState("");
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [editingRegionValue, setEditingRegionValue] = useState("");

  const { data: lists = [] } = useQuery({
    queryKey: ["supplier-lists", objectId ?? `org:${organizationId}`],
    queryFn: async () => {
      let q = supabase
        .from("supplier_lists" as any)
        .select("id, name, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      q = objectId ? q.eq("object_id", objectId) : q.is("object_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ListRow[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && lists.length > 0 && !selectedListId) setSelectedListId(lists[0].id);
  }, [open, lists, selectedListId]);

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["supplier-list-items", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const { data, error } = await supabase
        .from("supplier_list_items" as any)
        .select("*")
        .eq("list_id", selectedListId)
        .order("region", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ItemRow[];
    },
    enabled: !!selectedListId,
  });

  const groupedItems = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const it of items) {
      const r = it.region || "Без региона";
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleCreateList = async () => {
    const name = creatingName.trim() || `Ведомость поставщиков — ${objectName}`;
    const { data, error } = await supabase
      .from("supplier_lists" as any)
      .insert({ organization_id: organizationId, object_id: objectId ?? null, name })
      .select("id, name, created_at")
      .single();
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setCreatingName("");
    setSelectedListId((data as any).id);
    qc.invalidateQueries({ queryKey: ["supplier-lists", objectId ?? `org:${organizationId}`] });
    toast({ title: "Ведомость создана" });
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm("Удалить ведомость и все её строки?")) return;
    await supabase.from("supplier_lists" as any).delete().eq("id", id);
    if (selectedListId === id) setSelectedListId(null);
    qc.invalidateQueries({ queryKey: ["supplier-lists", objectId ?? `org:${organizationId}`] });
  };

  const addRow = async (region: string) => {
    if (!selectedListId) return;
    const pos = items.filter(i => i.region === region).length;
    await supabase.from("supplier_list_items" as any).insert({
      list_id: selectedListId, organization_id: organizationId, region, position: pos,
    });
    refetchItems();
  };

  const addRegion = async () => {
    const r = newRegion.trim();
    if (!r || !selectedListId) return;
    await supabase.from("supplier_list_items" as any).insert({
      list_id: selectedListId, organization_id: organizationId, region: r, position: 0,
    });
    setNewRegion("");
    refetchItems();
  };

  const updateItem = async (id: string, patch: Partial<ItemRow>) => {
    await supabase.from("supplier_list_items" as any).update(patch).eq("id", id);
  };

  const renameRegion = async (oldRegion: string, newRegionName: string) => {
    if (!selectedListId || !newRegionName.trim() || newRegionName.trim() === oldRegion) return;
    const target = oldRegion === "Без региона" ? "" : oldRegion;
    await supabase
      .from("supplier_list_items" as any)
      .update({ region: newRegionName.trim() })
      .eq("list_id", selectedListId)
      .eq("region", target);
    refetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("supplier_list_items" as any).delete().eq("id", id);
    refetchItems();
  };

  const normalizeUrlKey = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

  const enrich = async (item: ItemRow, urlOverride?: string) => {
    const url = (urlOverride ?? item.website_url ?? "").trim();
    if (!url) {
      toast({ title: "Сначала вставьте ссылку на сайт", variant: "destructive" });
      return;
    }
    setEnrichingId(item.id);
    try {
      if (url !== (item.website_url ?? "")) {
        await supabase.from("supplier_list_items" as any).update({ website_url: url }).eq("id", item.id);
      }
      const { data, error } = await supabase.functions.invoke("extract-supplier-from-url", {
        body: { url },
      });
      if (error) throw error;

      const success = !!data.success;

      // Dedupe: if another row in the same list already has the same normalized URL, merge into it and delete current
      const key = normalizeUrlKey(data.website_url || url);
      const duplicate = items.find(i => i.id !== item.id && i.website_url && normalizeUrlKey(i.website_url) === key);
      const targetId = duplicate?.id ?? item.id;

      const patch: any = {
        website_url: data.website_url || url,
        supplier_name: success ? (data.supplier_name || null) : null,
        contact_person: success ? (data.contact_person || null) : null,
        phone: success ? (data.phone || null) : null,
        email: success ? (data.email || null) : null,
        address: success ? (data.address || null) : null,
        payment_terms: success ? (data.payment_terms || null) : null,
        extraction_failed: !success,
      };
      if (success && data.region) patch.region = data.region;

      await supabase.from("supplier_list_items" as any).update(patch).eq("id", targetId);
      if (duplicate) {
        await supabase.from("supplier_list_items" as any).delete().eq("id", item.id);
      }
      refetchItems();
      toast({
        title: success ? "Данные подтянуты" : "Не удалось распознать",
        description: success ? undefined : "Поля отмечены красным — заполните вручную",
        variant: success ? "default" : "destructive",
      });
    } catch (e: any) {
      await supabase.from("supplier_list_items" as any).update({ extraction_failed: true }).eq("id", item.id);
      refetchItems();
      toast({ title: "Ошибка", description: e?.message || "Не удалось извлечь данные", variant: "destructive" });
    } finally {
      setEnrichingId(null);
    }
  };

  const exportExcel = () => {
    if (!items.length) return;
    const list = lists.find(l => l.id === selectedListId);
    const rows: any[][] = [
      [list?.name || "Ведомость поставщиков"],
      ["Объект:", objectName],
      ["Дата составления:", new Date().toLocaleDateString("ru-RU")],
      [],
      ["№", "Ссылка на сайт", "Регион поставки", "Наименование поставщика", "Контактное лицо", "Телефон", "Email", "Условия оплаты", "Примечание"],
    ];
    let i = 1;
    for (const [region, list] of groupedItems) {
      rows.push([region]);
      for (const it of list) {
        rows.push([i++, it.website_url || "", it.region, it.supplier_name || "", it.contact_person || "", it.phone || "", it.email || "", it.payment_terms || "", it.note || ""]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 32 }, { wch: 22 }, { wch: 32 }, { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Поставщики");
    XLSX.writeFile(wb, `Ведомость поставщиков — ${objectName}.xlsx`);
  };

  const importExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Create a NEW dedicated list per imported file
      const baseName = file.name.replace(/\.(xlsx|xls)$/i, "").trim() || `Импорт ${new Date().toLocaleString("ru-RU")}`;
      const { data: newList, error: listErr } = await supabase
        .from("supplier_lists" as any)
        .insert({ organization_id: organizationId, object_id: objectId ?? null, name: baseName })
        .select("id")
        .single();
      if (listErr) throw listErr;
      const newListId = (newList as any).id as string;

      const HEADER_KEYS = ["регион", "поставщик", "назв", "организац", "компани", "контакт", "фио", "телеф", "тел", "phone", "email", "почт", "сайт", "url", "ссылк", "веб", "оплат", "усл", "примеч", "коммент"];
      const norm = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
      const lc = (v: any) => norm(v).toLowerCase();

      const allInserts: any[] = [];
      const positionsByRegion = new Map<string, number>();
      const nextPos = (r: string) => {
        const p = (positionsByRegion.get(r) ?? -1) + 1;
        positionsByRegion.set(r, p);
        return p;
      };

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!raw.length) continue;

        // Pick best header row: max keyword hits in first 25 rows (min 2)
        let headerIdx = -1; let best = 1;
        for (let i = 0; i < Math.min(raw.length, 25); i++) {
          const joined = raw[i].map(lc).join("|");
          const hits = HEADER_KEYS.reduce((n, k) => n + (joined.includes(k) ? 1 : 0), 0);
          if (hits > best) { best = hits; headerIdx = i; }
        }
        if (headerIdx < 0) continue;

        const headers = raw[headerIdx].map(lc);
        const findCol = (...keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
        const cRegion = findCol("регион", "край", "область");
        const cName = findCol("поставщик", "организац", "компани", "назв");
        const cContact = findCol("контакт", "фио", "представит", "менеджер");
        const cPhone = findCol("телеф", "тел.", "тел ", "phone", "моб");
        const cEmail = findCol("email", "почт", "e-mail", "мейл");
        const cUrl = findCol("сайт", "url", "ссылк", "веб");
        const cPay = findCol("оплат", "усл");
        const cNote = findCol("примеч", "коммент", "note");

        // Region tracked from "section header" rows (single meaningful cell)
        let currentRegion = wb.SheetNames.length > 1 ? sheetName : "";

        for (let i = headerIdx + 1; i < raw.length; i++) {
          const cells = raw[i].map(norm);
          const nonEmpty = cells.filter(Boolean);
          if (nonEmpty.length === 0) continue;

          const hasName = cName >= 0 && !!cells[cName];
          const hasPhone = cPhone >= 0 && !!cells[cPhone];
          const hasEmail = cEmail >= 0 && !!cells[cEmail];
          const hasUrl = cUrl >= 0 && !!cells[cUrl];
          const hasContact = cContact >= 0 && !!cells[cContact];

          // Section header row (region divider)
          if (nonEmpty.length <= 2 && !hasName && !hasPhone && !hasEmail && !hasUrl && !hasContact) {
            currentRegion = nonEmpty[0];
            continue;
          }

          if (!hasName && !hasPhone && !hasEmail && !hasUrl && !hasContact) continue;

          const region = (cRegion >= 0 && cells[cRegion]) ? cells[cRegion] : (currentRegion || "Без региона");

          allInserts.push({
            list_id: newListId,
            organization_id: organizationId,
            region,
            position: nextPos(region),
            supplier_name: hasName ? cells[cName] : null,
            contact_person: hasContact ? cells[cContact] : null,
            phone: hasPhone ? cells[cPhone] : null,
            email: hasEmail ? cells[cEmail] : null,
            website_url: hasUrl ? cells[cUrl] : null,
            payment_terms: cPay >= 0 && cells[cPay] ? cells[cPay] : null,
            note: cNote >= 0 && cells[cNote] ? cells[cNote] : null,
          });
        }
      }

      if (!allInserts.length) {
        await supabase.from("supplier_lists" as any).delete().eq("id", newListId);
        toast({ title: "Не удалось распознать данные", description: "Проверьте, что в файле есть строка-заголовок с колонками: поставщик, телефон, email, сайт…", variant: "destructive" });
        return;
      }

      const { error: insErr } = await supabase.from("supplier_list_items" as any).insert(allInserts);
      if (insErr) throw insErr;

      qc.invalidateQueries({ queryKey: ["supplier-lists", objectId ?? `org:${organizationId}`] });
      setSelectedListId(newListId);
      toast({ title: `Создана ведомость «${baseName}»`, description: `Импортировано строк: ${allInserts.length}` });
    } catch (e: any) {
      toast({ title: "Ошибка импорта", description: e?.message || String(e), variant: "destructive" });
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="contents">
          {trigger}
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Ведомость поставщиков
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose?.(); }}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Ведомость поставщиков — {objectName}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap border-b pb-3">
            <Select value={selectedListId || ""} onValueChange={setSelectedListId}>
              <SelectTrigger className="w-[320px]"><SelectValue placeholder="Выберите ведомость" /></SelectTrigger>
              <SelectContent>
                {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedListId && (
              <Button size="sm" variant="ghost" onClick={() => handleDeleteList(selectedListId)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Input
                placeholder="Название новой ведомости"
                value={creatingName}
                onChange={e => setCreatingName(e.target.value)}
                className="w-[280px]"
              />
              <Button size="sm" onClick={handleCreateList}>
                <Plus className="h-4 w-4 mr-1" /> Создать
              </Button>
              <Button size="sm" variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" /> Импорт Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) { importExcel(e.target.files[0]); e.target.value = ""; } }}
                  />
                </label>
              </Button>
              {selectedListId && items.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportExcel}>
                  <Download className="h-4 w-4 mr-1" /> Excel
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-auto flex-1">
            {!selectedListId ? (
              <div className="text-center text-muted-foreground py-20">
                Создайте ведомость, чтобы начать заполнение.
              </div>
            ) : (
              <div className="space-y-6 py-3">
                {groupedItems.map(([region, list]) => (
                  <div key={region} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 py-2 font-semibold flex items-center justify-between">
                      {editingRegion === region ? (
                        <Input
                          autoFocus
                          value={editingRegionValue}
                          onChange={e => setEditingRegionValue(e.target.value)}
                          onBlur={async () => {
                            await renameRegion(region, editingRegionValue);
                            setEditingRegion(null);
                            setEditingRegionValue("");
                          }}
                          onKeyDown={async e => {
                            if (e.key === "Enter") {
                              await renameRegion(region, editingRegionValue);
                              setEditingRegion(null);
                              setEditingRegionValue("");
                            }
                            if (e.key === "Escape") {
                              setEditingRegion(null);
                              setEditingRegionValue("");
                            }
                          }}
                          className="h-8 text-sm w-[240px]"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{region}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground"
                            onClick={() => {
                              setEditingRegion(region);
                              setEditingRegionValue(region === "Без региона" ? "" : region);
                            }}
                            title="Переименовать регион"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => addRow(region)}>
                        <Plus className="h-4 w-4 mr-1" /> Строка
                      </Button>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 w-10">№</th>
                          <th className="px-2 py-1">Ссылка</th>
                          <th className="px-2 py-1">Наименование</th>
                          <th className="px-2 py-1">Контактное лицо</th>
                          <th className="px-2 py-1">Телефон</th>
                          <th className="px-2 py-1">Email</th>
                          <th className="px-2 py-1">Условия оплаты</th>
                          <th className="px-2 py-1">Примечание</th>
                          <th className="px-2 py-1 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((it, idx) => (
                          <tr key={it.id} className="border-t hover:bg-muted/30">
                            <td className="px-2 py-1 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="px-1 py-1">
                              <div className="flex gap-1">
                                <Input
                                  id={`url-${it.id}`}
                                  defaultValue={it.website_url || ""}
                                  onBlur={e => updateItem(it.id, { website_url: e.target.value })}
                                  placeholder="https://..."
                                  className="h-8 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2"
                                  disabled={enrichingId === it.id}
                                  onClick={() => {
                                    const el = document.getElementById(`url-${it.id}`) as HTMLInputElement | null;
                                    enrich(it, el?.value);
                                  }}
                                  title="Подтянуть AI"
                                >
                                  {enrichingId === it.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                </Button>
                              </div>
                            </td>
                            <td className="px-1 py-1"><Input defaultValue={it.supplier_name || ""} onBlur={e => updateItem(it.id, { supplier_name: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-1 py-1"><Input defaultValue={it.contact_person || ""} onBlur={e => updateItem(it.id, { contact_person: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-1 py-1"><Input defaultValue={it.phone || ""} onBlur={e => updateItem(it.id, { phone: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-1 py-1"><Input defaultValue={it.email || ""} onBlur={e => updateItem(it.id, { email: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-1 py-1"><Input defaultValue={it.payment_terms || ""} onBlur={e => updateItem(it.id, { payment_terms: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-1 py-1"><Input defaultValue={it.note || ""} onBlur={e => updateItem(it.id, { note: e.target.value })} className="h-8 text-xs" /></td>
                            <td className="px-2 py-1 text-center">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(it.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <Input
                    placeholder="Новый регион..."
                    value={newRegion}
                    onChange={e => setNewRegion(e.target.value)}
                    className="w-[280px]"
                    onKeyDown={e => { if (e.key === "Enter") addRegion(); }}
                  />
                  <Button size="sm" variant="outline" onClick={addRegion}>
                    <Plus className="h-4 w-4 mr-1" /> Добавить регион
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
