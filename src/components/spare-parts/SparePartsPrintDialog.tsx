import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SparePartRow } from "@/hooks/useSpareParts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  parts: SparePartRow[]; // pre-filtered from list page
}

type SortKey = "manufacturer" | "model" | "category" | "storage" | "rack" | "cell" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "По наименованию" },
  { key: "manufacturer", label: "По производителю техники" },
  { key: "model", label: "По модели техники" },
  { key: "category", label: "По категории" },
  { key: "storage", label: "По месту хранения" },
  { key: "rack", label: "По стеллажу" },
  { key: "cell", label: "По ячейке" },
];

type LibBundle = {
  XLSX: typeof import("xlsx");
  jsPDF: (typeof import("jspdf"))["default"];
  autoTable: (typeof import("jspdf-autotable"))["default"];
};
let libsPromise: Promise<LibBundle> | null = null;
async function loadLibs(): Promise<LibBundle> {
  if (!libsPromise) {
    libsPromise = Promise.all([import("xlsx"), import("jspdf"), import("jspdf-autotable")]).then(
      ([XLSX, jspdf, autotable]) => ({ XLSX, jsPDF: jspdf.default, autoTable: autotable.default })
    );
  }
  return libsPromise;
}

let robotoCache: string | null = null;
async function loadRoboto() {
  if (robotoCache) return robotoCache;
  const buf = await fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  robotoCache = btoa(bin);
  return robotoCache;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function SparePartsPrintDialog({ open, onOpenChange, orgId, parts }: Props) {
  const [mode, setMode] = useState<"filter" | "equipment">("filter");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [withPhotos, setWithPhotos] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fetch org name + current user name
  const { data: header } = useQuery({
    queryKey: ["sp-print-header", orgId],
    queryFn: async () => {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
      const { data: userData } = await supabase.auth.getUser();
      let userName = userData.user?.email ?? "";
      if (userData.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userData.user.id).maybeSingle();
        userName = profile?.full_name || userName;
      }
      return { orgName: org?.name ?? "—", userName };
    },
    enabled: open,
  });

  // Equipment list for "по технике" mode
  const { data: equipment = [] } = useQuery({
    queryKey: ["sp-print-equipment", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipment")
        .select("id, brand, model, plate_number, year")
        .eq("organization_id", orgId)
        .order("brand");
      return data ?? [];
    },
    enabled: open,
  });

  // Load compatibility for all parts (map: partId → equipment[])
  const partIds = useMemo(() => parts.map((p) => p.id), [parts]);
  const { data: compatMap = {} } = useQuery({
    queryKey: ["sp-print-compat", partIds],
    queryFn: async () => {
      if (!partIds.length) return {};
      const { data } = await (supabase as any)
        .from("spare_part_equipment")
        .select("spare_part_id, equipment:equipment_id(id, brand, model, plate_number)")
        .in("spare_part_id", partIds);
      const map: Record<string, any[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!row.equipment) return;
        (map[row.spare_part_id] ??= []).push(row.equipment);
      });
      return map;
    },
    enabled: open && partIds.length > 0,
  });

  // Filtered + sorted list according to dialog options
  const rows = useMemo(() => {
    let list = [...parts];

    if (mode === "equipment" && equipmentId) {
      list = list.filter((p) => (compatMap[p.id] ?? []).some((e: any) => e.id === equipmentId));
    }

    if (onlyWithStock) list = list.filter((p) => (p.stock ?? 0) > 0);
    if (onlyLowStock) list = list.filter((p) => (p.stock ?? 0) <= (p.min_stock ?? 0));

    const cmp = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? "").localeCompare(b ?? "", "ru", { sensitivity: "base" });

    list.sort((a, b) => {
      switch (sortKey) {
        case "manufacturer": {
          const am = (compatMap[a.id] ?? [])[0]?.brand ?? "";
          const bm = (compatMap[b.id] ?? [])[0]?.brand ?? "";
          return cmp(am, bm) || cmp(a.name, b.name);
        }
        case "model": {
          const am = (compatMap[a.id] ?? [])[0]?.model ?? "";
          const bm = (compatMap[b.id] ?? [])[0]?.model ?? "";
          return cmp(am, bm) || cmp(a.name, b.name);
        }
        case "category":
          return cmp(a.category, b.category) || cmp(a.name, b.name);
        case "storage":
          return cmp(a.storage_location, b.storage_location) || cmp(a.name, b.name);
        case "rack":
          return cmp(a.rack, b.rack) || cmp(a.shelf, b.shelf) || cmp(a.cell, b.cell) || cmp(a.name, b.name);
        case "cell":
          return cmp(a.cell, b.cell) || cmp(a.name, b.name);
        default:
          return cmp(a.name, b.name);
      }
    });

    return list;
  }, [parts, mode, equipmentId, onlyWithStock, onlyLowStock, sortKey, compatMap]);

  const totalStock = rows.reduce((s, p) => s + (p.stock ?? 0), 0);

  const compatText = (p: SparePartRow) => {
    const list = compatMap[p.id] ?? [];
    if (!list.length) return "—";
    return list.map((e: any) => `${e.brand} ${e.model}${e.plate_number ? ` (${e.plate_number})` : ""}`).join(", ");
  };

  const compatLines = (p: SparePartRow) => {
    const list = compatMap[p.id] ?? [];
    return list.map((e: any) => `${e.brand} ${e.model}${e.plate_number ? ` (${e.plate_number})` : ""}`);
  };

  const storageText = (p: SparePartRow) => {
    const parts = [p.storage_location, p.rack && `Ст. ${p.rack}`, p.shelf && `П. ${p.shelf}`, p.cell && `Яч. ${p.cell}`].filter(Boolean);
    return parts.join(" · ") || "—";
  };

  const equipmentLabel = () => {
    const e = equipment.find((x: any) => x.id === equipmentId);
    return e ? `${e.brand} ${e.model}${e.plate_number ? ` (${e.plate_number})` : ""}` : "";
  };

  const buildTitle = () =>
    mode === "equipment" && equipmentId
      ? `Ведомость по технике: ${equipmentLabel()}`
      : "Ведомость запасных частей";

  // ---------- PHOTOS ----------
  // Sign photo URLs; used by HTML print and PDF
  const [signedPhotos, setSignedPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !withPhotos) return;
    (async () => {
      const paths: string[] = [];
      rows.forEach((p) => {
        const first = (p.photos ?? [])[0];
        if (first) paths.push(first);
      });
      if (!paths.length) return;
      const map: Record<string, string> = {};
      await Promise.all(
        paths.map(async (path) => {
          const clean = path.replace(/^spare-parts-photos\//, "");
          const { data } = await supabase.storage.from("spare-parts-photos").createSignedUrl(clean, 3600);
          if (data?.signedUrl) map[path] = data.signedUrl;
        })
      );
      setSignedPhotos(map);
    })();
  }, [open, withPhotos, rows]);

  const fetchImageDataUrl = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => res(null);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // ---------- HTML PRINT ----------
  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Разрешите всплывающие окна"); return; }
    const title = buildTitle();
    const dateStr = new Date().toLocaleDateString("ru-RU");
    const orgName = header?.orgName ?? "";
    const userName = header?.userName ?? "";

    const colHeaders = [
      ...(withPhotos ? ["Фото"] : []),
      "Наименование",
      "Артикул",
      "Кросс-номер",
      "Совместимость",
      "Место хранения",
      "Остаток",
      "Ед.",
      "К выдаче",
      "Отметка",
      "Подпись",
    ];

    const rowsHtml = rows
      .map((p) => {
        const photoPath = (p.photos ?? [])[0];
        const photoUrl = photoPath ? signedPhotos[photoPath] : null;
        const photoCell = withPhotos
          ? `<td class="photo">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" />` : ""}</td>`
          : "";
        return `<tr>
          ${photoCell}
          <td class="name">${escapeHtml(p.name || "")}</td>
          <td>${escapeHtml(p.article || "—")}</td>
          <td>${escapeHtml((p.cross_numbers ?? []).join(", ") || "—")}</td>
          <td class="compat">${compatLines(p).map(escapeHtml).join("<br/>") || "—"}</td>
          <td>${escapeHtml(storageText(p))}</td>
          <td class="num">${p.stock ?? 0}</td>
          <td>${escapeHtml(p.unit || "шт")}</td>
          <td class="blank"></td>
          <td class="blank"></td>
          <td class="blank"></td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/>
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; color: #111; }
        header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px; }
        h1 { font-size: 13pt; margin: 0 0 4px 0; }
        .meta { font-size: 9pt; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; font-size: 9pt; }
        th { background: #eee; font-weight: 600; text-align: left; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.blank { min-width: 60px; }
        td.name { font-weight: 600; }
        td.compat { max-width: 180px; }
        td.photo { text-align: center; width: 60px; }
        td.photo img { max-width: 55px; max-height: 55px; object-fit: contain; }
        tfoot td { font-weight: 600; background: #f5f5f5; }
        .totals { margin-top: 8px; font-size: 10pt; display: flex; gap: 24px; }
        @media print { .no-print { display: none; } }
      </style>
      </head><body>
        <header>
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(orgName)}</div>
              <div>Дата: ${escapeHtml(dateStr)}</div>
              <div>Сформировал: ${escapeHtml(userName)}</div>
            </div>
          </div>
          <div class="meta" style="text-align:right;">
            <div>Всего позиций: <b>${rows.length}</b></div>
            <div>Общий остаток: <b>${totalStock}</b></div>
          </div>
        </header>
        <table>
          <thead><tr>${colHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="${colHeaders.length}" style="text-align:center;padding:24px;">Нет данных</td></tr>`}</tbody>
        </table>
        <div class="totals">
          <div>Всего позиций: <b>${rows.length}</b></div>
          <div>Общий остаток: <b>${totalStock}</b></div>
        </div>
        <div class="no-print" style="margin-top:16px;">
          <button onclick="window.print()">Печать</button>
        </div>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
      </body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // ---------- PDF ----------
  const handlePdf = async () => {
    setBusy(true);
    try {
      const { jsPDF, autoTable } = await loadLibs();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const b64 = await loadRoboto();
      doc.addFileToVFS("Roboto-Regular.ttf", b64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.setFont("Roboto");

      const title = buildTitle();
      const dateStr = new Date().toLocaleDateString("ru-RU");

      doc.setFontSize(13);
      doc.text(title, 30, 30);
      doc.setFontSize(9);
      doc.text(`${header?.orgName ?? ""}`, 30, 46);
      doc.text(`Дата: ${dateStr}   Сформировал: ${header?.userName ?? ""}`, 30, 58);

      const columns = [
        ...(withPhotos ? [{ header: "Фото", dataKey: "photo" }] : []),
        { header: "Наименование", dataKey: "name" },
        { header: "Артикул", dataKey: "article" },
        { header: "Кросс-номер", dataKey: "cross" },
        { header: "Совместимость", dataKey: "compat" },
        { header: "Место", dataKey: "storage" },
        { header: "Остаток", dataKey: "stock" },
        { header: "Ед.", dataKey: "unit" },
        { header: "К выдаче", dataKey: "issue" },
        { header: "Отметка", dataKey: "check" },
        { header: "Подпись", dataKey: "sign" },
      ];

      // Preload photos as data URLs
      const photoData: Record<string, string> = {};
      if (withPhotos) {
        await Promise.all(
          rows.map(async (p) => {
            const path = (p.photos ?? [])[0];
            if (!path) return;
            const url = signedPhotos[path];
            if (!url) return;
            const dataUrl = await fetchImageDataUrl(url);
            if (dataUrl) photoData[p.id] = dataUrl;
          })
        );
      }

      const body = rows.map((p) => ({
        photo: "",
        name: p.name || "",
        article: p.article || "—",
        cross: (p.cross_numbers ?? []).join(", ") || "—",
        compat: compatLines(p).join("\n") || "—",
        storage: storageText(p),
        stock: String(p.stock ?? 0),
        unit: p.unit || "шт",
        issue: "",
        check: "",
        sign: "",
        __id: p.id,
      }));

      autoTable(doc, {
        startY: 72,
        columns,
        body: body as any,
        theme: "grid",
        styles: { font: "Roboto", fontSize: 8, cellPadding: 3, valign: "top", overflow: "linebreak" },
        headStyles: { font: "Roboto", fillColor: [230, 230, 230], textColor: 20, fontStyle: "normal" },
        bodyStyles: { font: "Roboto" },
        columnStyles: {
          photo: { cellWidth: 45, minCellHeight: withPhotos ? 45 : 12 },
          stock: { halign: "right" },
          issue: { cellWidth: 45 },
          check: { cellWidth: 45 },
          sign: { cellWidth: 55 },
        },
        didDrawCell: (data: any) => {
          if (data.section !== "body" || data.column.dataKey !== "photo") return;
          const row = body[data.row.index];
          const img = row && photoData[(row as any).__id];
          if (!img) return;
          const { x, y, width, height } = data.cell;
          const size = Math.min(width, height) - 2;
          try {
            doc.addImage(img, "JPEG", x + (width - size) / 2, y + (height - size) / 2, size, size);
          } catch {
            /* ignore */
          }
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
      doc.setFontSize(10);
      doc.text(`Всего позиций: ${rows.length}    Общий остаток: ${totalStock}`, 30, finalY + 20);

      const fileName = `Ведомость_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      toast.success("PDF сформирован");
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось сформировать PDF");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Excel ----------
  const handleExcel = async () => {
    setBusy(true);
    try {
      const { XLSX } = await loadLibs();
      const data = rows.map((p) => ({
        Наименование: p.name || "",
        Артикул: p.article || "",
        "Кросс-номер": (p.cross_numbers ?? []).join(", "),
        Совместимость: compatLines(p).join("; "),
        "Место хранения": storageText(p),
        Остаток: p.stock ?? 0,
        "Ед.": p.unit || "шт",
        "К выдаче": "",
        Отметка: "",
        Подпись: "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ведомость");
      // Meta sheet
      const meta = [
        ["Организация", header?.orgName ?? ""],
        ["Дата", new Date().toLocaleDateString("ru-RU")],
        ["Сформировал", header?.userName ?? ""],
        ["Заголовок", buildTitle()],
        ["Всего позиций", rows.length],
        ["Общий остаток", totalStock],
      ];
      const wsMeta = XLSX.utils.aoa_to_sheet(meta);
      XLSX.utils.book_append_sheet(wb, wsMeta, "Инфо");
      XLSX.writeFile(wb, `Ведомость_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel сформирован");
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось сформировать Excel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Печать ведомости запчастей</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="filter">По фильтру</TabsTrigger>
              <TabsTrigger value="equipment">По технике</TabsTrigger>
            </TabsList>
            <TabsContent value="filter" className="text-sm text-muted-foreground pt-2">
              Печать текущего отфильтрованного списка каталога.
            </TabsContent>
            <TabsContent value="equipment" className="pt-2">
              <Label>Выберите технику</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger><SelectValue placeholder="Не выбрано" /></SelectTrigger>
                <SelectContent>
                  {equipment.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.brand} {e.model}{e.plate_number ? ` • ${e.plate_number}` : ""}{e.year ? ` (${e.year})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>

          <div>
            <Label>Сортировка</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={onlyWithStock} onCheckedChange={(v) => setOnlyWithStock(!!v)} />
              Только позиции с остатком
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={onlyLowStock} onCheckedChange={(v) => setOnlyLowStock(!!v)} />
              Только заканчивающиеся позиции
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={withPhotos} onCheckedChange={(v) => setWithPhotos(!!v)} />
              Печатать фотографии деталей
            </label>
          </div>

          <div className="rounded-md border p-3 bg-muted/30 text-sm flex flex-wrap gap-3">
            <Badge variant="secondary">Строк: {rows.length}</Badge>
            <Badge variant="outline">Общий остаток: {totalStock}</Badge>
            {mode === "equipment" && equipmentId && <Badge>{equipmentLabel()}</Badge>}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          <Button variant="outline" onClick={handleExcel} disabled={busy || rows.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            Excel
          </Button>
          <Button variant="outline" onClick={handlePdf} disabled={busy || rows.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            PDF
          </Button>
          <Button onClick={handlePrint} disabled={rows.length === 0}>
            <Printer className="h-4 w-4 mr-1" />Печать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
