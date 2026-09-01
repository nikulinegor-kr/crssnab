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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { BookUser, Check, ChevronsUpDown, Loader2, Upload, X } from "lucide-react";

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
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [onlyMatched, setOnlyMatched] = useState(true);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<MatchRow[] | null>(null);
  const [search, setSearch] = useState("");

  const visibleRows = useMemo(() => {
    const base = onlyMatched ? matches.filter((m) => m.newPhone) : matches;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    const terms = q.split(/\s+/);
    return base.filter((m) => {
      const hay = `${m.supplierName} ${m.contactName} ${m.newPhone}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [matches, onlyMatched, search]);

  const selectedCount = useMemo(() => matches.filter((m) => m.selected && m.newPhone).length, [matches]);

  const applyRows = async (rows: MatchRow[]) => {
    if (!rows.length) return;
    setIsSaving(true);
    const done: MatchRow[] = [];
    try {
      for (const m of rows) {
        const { error } = await supabase.from("suppliers").update({ phone: m.newPhone }).eq("id", m.supplierId);
        if (!error) done.push(m);
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setResult(done);
      setMatches([]);
      toast({ title: "Телефоны обновлены", description: `Заполнено номеров: ${done.length} из ${rows.length}` });
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const buildMatches = (list: ContactEntry[], withOverwrite: boolean) => {
    const contactIndex = new Map<string, ContactEntry>();
    for (const c of list) {
      for (const k of matchKeys(c.name)) {
        if (!contactIndex.has(k)) contactIndex.set(k, c);
      }
    }
    const rows: MatchRow[] = [];
    for (const s of suppliers) {
      if (s.phone && !withOverwrite) continue;
      const keys = matchKeys(s.name);
      let hit: ContactEntry | undefined;
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
      rows.push({
        supplierId: s.id,
        supplierName: s.name,
        currentPhone: s.phone,
        contactName: hit?.name ?? "",
        newPhone: hit?.phone ?? "",
        selected: !!hit,
      });
    }
    return rows;
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setMatches([]);
    setResult(null);
    setFileName(file.name);
    try {
      const isVcf = /\.(vcf|vcard)$/i.test(file.name) || file.type === "text/vcard";
      const list = isVcf ? parseVcf(await file.text()) : await parseExcel(file);
      if (!list.length) {
        toast({
          title: "Контакты не найдены",
          description: "Поддерживаются .vcf (экспорт контактов телефона) и Excel/CSV с колонками «Имя» и «Телефон»",
          variant: "destructive",
        });
        return;
      }
      setContacts(list);
      const rows = buildMatches(list, overwrite);
      setMatches(rows);
      const matched = rows.filter((r) => r.newPhone).length;
      toast({
        title: `Контактов в файле: ${list.length}`,
        description: matched
          ? `Автоматически сопоставлено: ${matched}. Остальным можно выбрать контакт вручную.`
          : "Автосовпадений нет — выберите контакты вручную в списке.",
      });
      if (!matched) setOnlyMatched(false);
    } catch (e: any) {
      toast({ title: "Ошибка чтения файла", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const setRowContact = (supplierId: string, c: ContactEntry | null) =>
    setMatches((prev) =>
      prev.map((x) =>
        x.supplierId === supplierId
          ? { ...x, contactName: c?.name ?? "", newPhone: c?.phone ?? "", selected: !!c }
          : x,
      ),
    );

  const handleApply = () => applyRows(matches.filter((m) => m.selected && m.newPhone));

  const close = () => {
    onOpenChange(false);
    setResult(null);
    setMatches([]);
    setContacts([]);
    setFileName("");
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookUser className="h-5 w-5" />
            Телефоны из телефонной книги
          </DialogTitle>
          <DialogDescription>
            Загрузите .vcf (или Excel с колонками «Имя» и «Телефон»). Совпадения подставятся автоматически, а для
            остальных поставщиков можно выбрать контакт вручную.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
            <div className="px-3 py-2 text-sm font-medium border-b sticky top-0 bg-background z-10">
              Заполнено телефонов: {result.length}
            </div>
            {result.map((m) => (
              <div key={m.supplierId} className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1 font-medium">{m.supplierName}</span>
                <span className="truncate text-muted-foreground hidden sm:block">{m.contactName || "—"}</span>
                <span className="font-numeric">{m.newPhone}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
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

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pb-overwrite"
                    checked={overwrite}
                    onCheckedChange={(v) => {
                      setOverwrite(!!v);
                      if (contacts.length) setMatches(buildMatches(contacts, !!v));
                    }}
                  />
                  <Label htmlFor="pb-overwrite" className="text-sm cursor-pointer">
                    Включая поставщиков с заполненным телефоном
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="pb-only-matched" checked={onlyMatched} onCheckedChange={(v) => setOnlyMatched(!!v)} />
                  <Label htmlFor="pb-only-matched" className="text-sm cursor-pointer">
                    Только найденные совпадения
                  </Label>
                </div>
              </div>

              {matches.length > 0 && (
                <Input
                  placeholder="Поиск по поставщику или контакту..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </div>

            {matches.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
                <div className="grid grid-cols-[24px_1fr_1fr] gap-x-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
                  <span />
                  <span className="text-left">Поставщик</span>
                  <span className="text-left">Контакт / телефон</span>
                </div>
                {visibleRows.map((m) => (
                  <div
                    key={m.supplierId}
                    className="grid grid-cols-[24px_1fr_1fr] gap-x-3 px-3 py-2 text-sm border-b last:border-b-0 items-center"
                  >
                    <Checkbox
                      checked={m.selected}
                      disabled={!m.newPhone}
                      onCheckedChange={(v) =>
                        setMatches((prev) =>
                          prev.map((x) => (x.supplierId === m.supplierId ? { ...x, selected: !!v } : x)),
                        )
                      }
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.supplierName}</div>
                      {m.currentPhone && <div className="text-xs text-muted-foreground">сейчас: {m.currentPhone}</div>}
                    </div>
                    <ContactPicker
                      contacts={contacts}
                      value={m.newPhone ? { name: m.contactName, phone: m.newPhone } : null}
                      onChange={(c) => setRowContact(m.supplierId, c)}
                    />
                  </div>
                ))}
                {!visibleRows.length && (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">Ничего не найдено</div>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {result ? "Закрыть" : "Отмена"}
          </Button>
          {!result && (
            <Button onClick={handleApply} disabled={!selectedCount || isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Заполнить ({selectedCount})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactPicker({
  contacts,
  value,
  onChange,
}: {
  contacts: ContactEntry[];
  value: ContactEntry | null;
  onChange: (c: ContactEntry | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const list = terms.length
      ? contacts.filter((c) => terms.every((t) => `${c.name} ${c.phone}`.toLowerCase().includes(t)))
      : contacts;
    return list.slice(0, 200);
  }, [contacts, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between font-normal min-w-0">
          <span className="truncate text-left">
            {value ? (
              <>
                <span className="font-numeric">{value.phone}</span>
                <span className="text-muted-foreground"> · {value.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Выбрать контакт</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Поиск контакта..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Контакты не найдены</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" /> Очистить
                </CommandItem>
              )}
              {filtered.map((c, i) => (
                <CommandItem
                  key={`${c.phone}-${i}`}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-numeric">{c.phone}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

