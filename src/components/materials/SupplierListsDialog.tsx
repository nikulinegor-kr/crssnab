import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, Trash2, Download, Loader2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  objectId?: string | null;
  objectName: string;
  organizationId: string;
  trigger?: React.ReactNode;
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
  payment_terms: string | null;
  note: string | null;
}

const DEFAULT_REGIONS = [
  "Новосибирск", "Хабаровский край", "Иркутская область",
  "Красноярский край", "Екатеринбург", "Челябинск",
];

export const SupplierListsDialog = ({ objectId, objectName, organizationId, trigger }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState("");
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [newRegion, setNewRegion] = useState("");

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
    // Seed default regions with one empty row each
    const seeds = DEFAULT_REGIONS.map((region, idx) => ({
      list_id: (data as any).id, organization_id: organizationId, region, position: 0,
    }));
    await supabase.from("supplier_list_items" as any).insert(seeds);
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

  const deleteItem = async (id: string) => {
    await supabase.from("supplier_list_items" as any).delete().eq("id", id);
    refetchItems();
  };

  const enrich = async (item: ItemRow) => {
    if (!item.website_url) {
      toast({ title: "Сначала вставьте ссылку на сайт", variant: "destructive" });
      return;
    }
    setEnrichingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("extract-supplier-from-url", {
        body: { url: item.website_url },
      });
      if (error) throw error;
      const patch = {
        supplier_name: data.supplier_name || item.supplier_name,
        contact_person: data.contact_person || item.contact_person,
        phone: data.phone || item.phone,
        email: data.email || item.email,
      };
      await supabase.from("supplier_list_items" as any).update(patch).eq("id", item.id);
      refetchItems();
      toast({ title: data.fetched ? "Данные подтянуты" : "Сайт недоступен — AI вернул что смог" });
    } catch (e: any) {
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

      <Dialog open={open} onOpenChange={setOpen}>
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
                      <span>{region}</span>
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
                                  defaultValue={it.website_url || ""}
                                  onBlur={e => updateItem(it.id, { website_url: e.target.value })}
                                  placeholder="https://..."
                                  className="h-8 text-xs"
                                />
                                <Button size="sm" variant="outline" className="h-8 px-2" disabled={enrichingId === it.id} onClick={() => enrich(it)} title="Подтянуть AI">
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
