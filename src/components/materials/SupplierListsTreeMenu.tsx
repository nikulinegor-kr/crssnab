import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SupplierListsDialog } from "./SupplierListsDialog";
import * as XLSX from "xlsx";

interface Props {
  objectId: string;
  objectName: string;
  organizationId: string;
}

interface ListRow {
  id: string;
  name: string;
  created_at: string;
}

export const SupplierListsTreeMenu = ({ objectId, objectName, organizationId }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [createBlank, setCreateBlank] = useState(false);

  const queryKey = ["supplier-lists", objectId];

  const { data: lists = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_lists" as any)
        .select("id, name, created_at")
        .eq("organization_id", organizationId)
        .eq("object_id", objectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ListRow[];
    },
    enabled: expanded,
  });

  const createBlankList = async () => {
    const { data, error } = await supabase
      .from("supplier_lists" as any)
      .insert({
        organization_id: organizationId,
        object_id: objectId,
        name: `Новая ведомость ${new Date().toLocaleDateString("ru-RU")}`,
      })
      .select("id")
      .single();
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey });
    setOpenListId((data as any).id);
    setCreateBlank(true);
  };

  const deleteList = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить ведомость и все её строки?")) return;
    await supabase.from("supplier_lists" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey });
  };

  // Excel import → creates new list directly here (no dialog needed)
  const importExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const baseName = file.name.replace(/\.(xlsx|xls)$/i, "").trim() || `Импорт ${new Date().toLocaleString("ru-RU")}`;

      const { data: newList, error: listErr } = await supabase
        .from("supplier_lists" as any)
        .insert({ organization_id: organizationId, object_id: objectId, name: baseName })
        .select("id")
        .single();
      if (listErr) throw listErr;
      const newListId = (newList as any).id as string;

      const HEADER_KEYS = ["регион", "поставщик", "назв", "организац", "компани", "контакт", "фио", "телеф", "тел", "phone", "email", "почт", "сайт", "url", "ссылк", "веб", "оплат", "усл", "примеч", "коммент"];
      const norm = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
      const lc = (v: any) => norm(v).toLowerCase();
      const allInserts: any[] = [];
      const positionsByRegion = new Map<string, number>();
      const nextPos = (r: string) => { const p = (positionsByRegion.get(r) ?? -1) + 1; positionsByRegion.set(r, p); return p; };

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!raw.length) continue;
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
          if (nonEmpty.length <= 2 && !hasName && !hasPhone && !hasEmail && !hasUrl && !hasContact) {
            currentRegion = nonEmpty[0]; continue;
          }
          if (!hasName && !hasPhone && !hasEmail && !hasUrl && !hasContact) continue;
          const region = (cRegion >= 0 && cells[cRegion]) ? cells[cRegion] : (currentRegion || "Без региона");
          allInserts.push({
            list_id: newListId, organization_id: organizationId, region, position: nextPos(region),
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
        toast({ title: "Не удалось распознать данные", description: "Нужна строка-заголовок: поставщик, телефон, email…", variant: "destructive" });
        return;
      }
      const { error: insErr } = await supabase.from("supplier_list_items" as any).insert(allInserts);
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey });
      setOpenListId(newListId);
      toast({ title: `Создана ведомость «${baseName}»`, description: `Импортировано строк: ${allInserts.length}` });
    } catch (e: any) {
      toast({ title: "Ошибка импорта", description: e?.message || String(e), variant: "destructive" });
    }
  };

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-accent/50"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
        <span className="truncate flex-1 text-left text-xs font-medium">Ведомость поставщиков</span>
        {expanded && lists.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-normal flex-shrink-0">{lists.length}</span>
        )}
      </button>

      {expanded && (
        <div className="ml-5 border-l border-border/50 pl-2 py-0.5 space-y-0.5">
          {lists.map(l => (
            <div
              key={l.id}
              className="group/list w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md hover:bg-accent/50 cursor-pointer"
              onClick={() => { setOpenListId(l.id); setCreateBlank(false); }}
            >
              <FileSpreadsheet className="h-3 w-3 text-blue-500/70 flex-shrink-0" />
              <span className="truncate flex-1 text-left text-xs">{l.name}</span>
              <Trash2
                className="h-3 w-3 text-destructive cursor-pointer opacity-0 group-hover/list:opacity-100 flex-shrink-0"
                onClick={(e) => deleteList(l.id, e)}
              />
            </div>
          ))}
          <button
            className="w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded-md text-primary hover:bg-accent/50"
            onClick={createBlankList}
          >
            <Plus className="h-3 w-3" /> Создать новую
          </button>
          <label className="w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded-md text-primary hover:bg-accent/50 cursor-pointer">
            <Upload className="h-3 w-3" /> Импорт Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) { importExcel(e.target.files[0]); e.target.value = ""; } }}
            />
          </label>
        </div>
      )}

      {openListId && (
        <SupplierListsDialog
          objectId={objectId}
          objectName={objectName}
          organizationId={organizationId}
          initialListId={openListId}
          openInitially
          onClose={() => { setOpenListId(null); setCreateBlank(false); qc.invalidateQueries({ queryKey }); }}
        />
      )}
    </div>
  );
};
