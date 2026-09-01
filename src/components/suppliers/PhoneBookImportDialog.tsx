import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BookUser, Loader2, Upload } from "lucide-react";

interface SupplierLite {
  id: string;
  name: string;
  phone: string | null;
}

interface PhoneBookImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierLite[];
}

interface ContactEntry {
  name: string;
  phone: string;
}

interface MatchRow {
  supplierId: string;
  supplierName: string;
  currentPhone: string | null;
  contactName: string;
  newPhone: string;
  selected: boolean;
}

/** Нормализация названия для сопоставления: без ОПФ, кавычек, регистра */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/общество\s+с\s+ограниченн?ой\s+ответственн?остью|индивидуальный\s+предприниматель|акционерное\s+общество/g, " ")
    .replace(/\b(ооо|зао|оао|ао|пао|нао|ип|гк|муп|фгуп)\b/g, " ")
    .replace(/[«»""'„"(),.\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ключи для поиска совпадений: полный ключ + отдельные значимые слова (>=4 симв.) */
function matchKeys(name: string): string[] {
  const key = normalizeKey(name);
  if (!key) return [];
  const keys = [key];
  const words = key.split(" ").filter((w) => w.length >= 4);
  // фамилия / основное слово названия
  keys.push(...words);
  return keys;
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  const justDigits = digits.replace(/\D/g, "");
  if (justDigits.length === 11 && justDigits.startsWith("8")) {
    digits = "+7" + justDigits.slice(1);
  } else if (justDigits.length === 10) {
    digits = "+7" + justDigits;
  } else if (justDigits.length === 11 && justDigits.startsWith("7")) {
    digits = "+" + justDigits;
  }
  return digits;
}

/** Парсинг .vcf (экспорт контактов с телефона) */
function parseVcf(text: string): ContactEntry[] {
  const entries: ContactEntry[] = [];
  const cards = text.split(/BEGIN:VCARD/i);
  for (const card of cards) {
    const nameMatch = card.match(/^FN[^:]*:(.+)$/m) || card.match(/^N[^:]*:(.+)$/m);
    if (!nameMatch) continue;
    let name = nameMatch[1].trim();
    if (/^N[^:]*:/m.test(nameMatch[0])) {
      // N:Фамилия;Имя;Отчество;;
      name = name.split(";").filter(Boolean).join(" ");
    }
    const telMatches = [...card.matchAll(/^TEL[^:]*:(.+)$/gm)];
    for (const t of telMatches) {
      const phone = normalizePhone(t[1]);
      if (name && phone) entries.push({ name: name.trim(), phone });
    }
  }
  return entries;
}

/** Парсинг Excel/CSV: ищем колонки имени и телефона */
async function parseExcel(file: File): Promise<ContactEntry[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const norm = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
  const entries: ContactEntry[] = [];

  for (const sheetName of wb.SheetNames) {
    const raw: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    if (!raw.length) continue;

    // Ищем строку заголовка с "телефон"/"имя"
    let headerIdx = -1;
    let cName = -1;
    let cPhone = -1;
    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      const headers = raw[i].map((v) => norm(v).toLowerCase());
      const n = headers.findIndex((h) => /назв|имя|контакт|фио|поставщик|организац|компани/.test(h));
      const p = headers.findIndex((h) => /телеф|тел\b|phone|моб|номер/.test(h));
      if (n >= 0 && p >= 0) {
        headerIdx = i;
        cName = n;
        cPhone = p;
        break;
      }
    }

    // Без заголовка: первая колонка = имя, вторая = телефон
    const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
    if (headerIdx < 0) {
      cName = 0;
      cPhone = 1;
    }

    for (let i = startRow; i < raw.length; i++) {
      const name = norm(raw[i][cName]);
      const phone = normalizePhone(norm(raw[i][cPhone]));
      if (name && phone) entries.push({ name, phone });
    }
  }
  return entries;
}

export function PhoneBookImportDialog({ open, onOpenChange, suppliers }: PhoneBookImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [fileName, setFileName] = useState("");

  const selectedCount = useMemo(() => matches.filter((m) => m.selected).length, [matches]);

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setMatches([]);
    setFileName(file.name);
    try {
      const isVcf = /\.(vcf|vcard)$/i.test(file.name) || file.type === "text/vcard";
      const contacts = isVcf ? parseVcf(await file.text()) : await parseExcel(file);
      if (!contacts.length) {
        toast({
          title: "Контакты не найдены",
          description: "Поддерживаются .vcf (экспорт контактов телефона) и Excel/CSV с колонками «Имя» и «Телефон»",
          variant: "destructive",
        });
        return;
      }

      // Индекс контактов по ключам
      const contactIndex = new Map<string, ContactEntry>();
      for (const c of contacts) {
        for (const k of matchKeys(c.name)) {
          if (!contactIndex.has(k)) contactIndex.set(k, c);
        }
      }

      const found: MatchRow[] = [];
      for (const s of suppliers) {
        if (s.phone && !overwrite) continue;
        const keys = matchKeys(s.name);
        let hit: ContactEntry | undefined;
        // сначала ищем по полному ключу, потом по словам
        const fullKey = normalizeKey(s.name);
        if (fullKey && contactIndex.has(fullKey)) {
          hit = contactIndex.get(fullKey);
        } else {
          for (const k of keys.slice(1)) {
            if (contactIndex.has(k)) {
              hit = contactIndex.get(k);
              break;
            }
          }
        }
        if (hit) {
          found.push({
            supplierId: s.id,
            supplierName: s.name,
            currentPhone: s.phone,
            contactName: hit.name,
            newPhone: hit.phone,
            selected: true,
          });
        }
      }

      if (!found.length) {
        toast({
          title: "Совпадений не найдено",
          description: `В файле ${contacts.length} контактов, но ни одно название не совпало с поставщиками`,
        });
        return;
      }
      setMatches(found);
    } catch (e: any) {
      toast({ title: "Ошибка чтения файла", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = async () => {
    const chosen = matches.filter((m) => m.selected);
    if (!chosen.length) return;
    setIsSaving(true);
    let updated = 0;
    try {
      for (const m of chosen) {
        const { error } = await supabase.from("suppliers").update({ phone: m.newPhone }).eq("id", m.supplierId);
        if (!error) updated++;
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Телефоны обновлены", description: `Заполнено номеров: ${updated}` });
      setMatches([]);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookUser className="h-5 w-5" />
            Телефоны из телефонной книги
          </DialogTitle>
          <DialogDescription>
            Экспортируйте контакты с телефона в файл .vcf (или подготовьте Excel с колонками «Имя» и «Телефон») —
            система найдёт совпадения по похожим названиям и предложит заполнить номера.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button variant="outline" className="gap-2 w-full" asChild disabled={isParsing}>
            <label className="cursor-pointer">
              {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isParsing ? "Читаем файл..." : fileName ? `Файл: ${fileName}` : "Выбрать файл (.vcf, .xlsx, .csv)"}
              <input
                type="file"
                accept=".vcf,.vcard,.xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>

          <div className="flex items-center gap-2">
            <Checkbox
              id="pb-overwrite"
              checked={overwrite}
              onCheckedChange={(v) => {
                setOverwrite(!!v);
                setMatches([]);
              }}
            />
            <Label htmlFor="pb-overwrite" className="text-sm cursor-pointer">
              Подбирать и для поставщиков, у которых телефон уже заполнен (перезапись)
            </Label>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
            <div className="grid grid-cols-[24px_1fr_1fr_130px] gap-x-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
              <span />
              <span className="text-left">Поставщик</span>
              <span className="text-left">Контакт из файла</span>
              <span className="text-left">Новый телефон</span>
            </div>
            {matches.map((m) => (
              <div
                key={m.supplierId}
                className="grid grid-cols-[24px_1fr_1fr_130px] gap-x-3 px-3 py-2 text-sm border-b last:border-b-0 items-center"
              >
                <Checkbox
                  checked={m.selected}
                  onCheckedChange={(v) =>
                    setMatches((prev) => prev.map((x) => (x.supplierId === m.supplierId ? { ...x, selected: !!v } : x)))
                  }
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.supplierName}</div>
                  {m.currentPhone && <div className="text-xs text-muted-foreground">сейчас: {m.currentPhone}</div>}
                </div>
                <div className="truncate text-muted-foreground">{m.contactName}</div>
                <div className="font-numeric">{m.newPhone}</div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleApply} disabled={!selectedCount || isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Заполнить ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
