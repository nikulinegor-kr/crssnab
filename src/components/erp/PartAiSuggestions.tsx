import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, Info, Camera, Wand2, X, BookOpen, Building2, ShieldCheck, ShieldAlert } from "lucide-react";

export interface PartAiSuggestion {
  duplicate: null | {
    id: string;
    name: string;
    article: string | null;
    manufacturer: string | null;
    storage_location: string | null;
    cross_numbers: string[];
    stock: number;
    equipment: Array<{ id: string; brand: string | null; model: string | null; plate_number: string | null }>;
  };
  price: null | {
    last_price: number;
    last_at: string;
    last_supplier: string | null;
    avg_price: number | null;
    suppliers: string[];
    purchase_count: number;
  };
  vision: null | {
    article: string | null;
    manufacturer: string | null;
    name: string | null;
    cross_numbers: string[];
  };
  ai: null | {
    article_found: boolean;
    not_found: boolean;
    article_normalized: string | null;
    sources: Array<{ name: string; trust?: string }>;
    official_info: null | {
      part_type_ru: string | null;
      name_en: string | null;
      name_ru: string | null;
      name_source: string | null;
      manufacturer_en: string | null;
      manufacturer_ru: string | null;
      manufacturer_source: string | null;
      description_ru: string | null;
      oems: string[];
      cross_numbers: string[];
    };
    catalog_compatibility: Array<{ brand: string; model: string; years?: string | null; engine?: string | null; source?: string | null }>;
    company_equipment: Array<{
      id: string;
      brand: string | null;
      model: string | null;
      plate_number: string | null;
      year: number | null;
      source?: string | null;
      sources?: string[];
      sources_count?: number;
      confirmation_type?: "OEM" | "Cross Reference" | null;
    }>;
    trust_level: "green" | "yellow" | "orange" | "red" | null;
    trust_reason: string | null;
    note: string | null;
  };
}


export interface PartAiAccept {
  manufacturer?: string;
  name?: string;
  category?: string;
  cross_numbers?: string[];
  equipment_ids?: string[];
  article?: string;
}

interface Props {
  orgId: string;
  kind: "filter" | "spare";
  article: string;
  crossNumbers: string[];
  name: string;
  manufacturer?: string;
  excludeId?: string;
  onAccept: (data: PartAiAccept) => void;
  onOpenDuplicate?: (id: string) => void;
  onMoveToDeadstock?: () => void;
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const TRUST_META: Record<string, { icon: string; label: string; className: string }> = {
  green: { icon: "🟢", label: "Проверено по официальному каталогу", className: "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300" },
  yellow: { icon: "🟡", label: "Проверено по проверенному каталогу", className: "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300" },
  orange: { icon: "🟠", label: "Проверено по нескольким сторонним каталогам", className: "border-orange-500/50 bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300" },
  red: { icon: "🔴", label: "Совместимость не подтверждена", className: "border-red-500/50 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300" },
};

export function PartAiSuggestions({
  orgId,
  kind,
  article,
  crossNumbers,
  name,
  manufacturer,
  excludeId,
  onAccept,
  onOpenDuplicate,
  onMoveToDeadstock,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PartAiSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const autoRanFor = useRef<string>("");

  // Auto-run when OEM article is entered / changed (debounced)
  useEffect(() => {
    const norm = article.toUpperCase().replace(/[\s\-_./]/g, "").trim();
    if (norm.length < 4) return;
    if (autoRanFor.current === norm) return;
    if (loading) return;
    const timer = setTimeout(() => {
      autoRanFor.current = norm;
      runAnalysis();
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  const runAnalysis = async (extras?: { image_base64?: string; image_mime?: string }) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    setDismissed(false);
    try {
      const { data: res, error } = await supabase.functions.invoke("analyze-part", {
        body: {
          orgId,
          kind,
          article: article.trim() || undefined,
          cross_number: crossNumbers[0] || undefined,
          name: name.trim() || undefined,
          manufacturer: manufacturer?.trim() || undefined,
          excludeId,
          image_base64: extras?.image_base64,
          image_mime: extras?.image_mime,
        },
      });
      if (error) throw error;
      const suggestion = res as PartAiSuggestion;
      setData(suggestion);
      setSelectedIds(new Set()); // never auto-select — user must pick
      // Photo vision: auto-fill only identifiers (never compatibility)
      if (suggestion?.vision) {
        onAccept({
          manufacturer: suggestion.vision.manufacturer ?? undefined,
          name: suggestion.vision.name ?? undefined,
          article: suggestion.vision.article ?? undefined,
          cross_numbers: suggestion.vision.cross_numbers?.length ? suggestion.vision.cross_numbers : undefined,
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Ошибка AI");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setPhotoUrl(dataUrl);
      const base64 = dataUrl.split(",")[1] || "";
      await runAnalysis({ image_base64: base64, image_mime: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  };

  const applyOfficial = () => {
    if (!data?.ai?.official_info) return;
    const oi = data.ai.official_info;
    onAccept({
      manufacturer: oi.manufacturer_ru ?? oi.manufacturer_en ?? undefined,
      name: oi.name_ru ?? oi.name_en ?? undefined,
      article: data.ai.article_normalized ?? undefined,
      cross_numbers: oi.cross_numbers?.length ? oi.cross_numbers : undefined,
      equipment_ids: Array.from(selectedIds),
    });
  };

  const toggleId = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ai = data?.ai;
  const noCompany = !!ai && (!ai.company_equipment || ai.company_equipment.length === 0);
  const notFound = !!ai && (ai.not_found || !ai.article_found);
  const trust = ai?.trust_level ? TRUST_META[ai.trust_level] : null;
  const hasInput = article.trim().length >= 2 || crossNumbers.length > 0 || name.trim().length >= 3 || (manufacturer?.trim().length ?? 0) >= 2;

  return (
    <div className="space-y-2">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI — поиск по официальным каталогам</span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 gap-1"
            disabled={loading || !hasInput}
            onClick={() => runAnalysis()}
          >
            <Wand2 className="h-4 w-4" />
            🤖 AI определить
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            disabled={loading}
            onClick={() => (isMobile() ? cameraRef.current?.click() : fileRef.current?.click())}
          >
            <Camera className="h-4 w-4" />
            📷 Распознать по фото
          </Button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {photoUrl && (
        <div className="relative inline-block">
          <img src={photoUrl} alt="Фото детали" className="max-h-32 rounded-md border" />
          <button type="button" onClick={() => setPhotoUrl(null)} className="absolute -top-2 -right-2 rounded-full bg-background border p-0.5 shadow" aria-label="Убрать фото">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          AI ищет по каталогам OEM / Donaldson / Baldwin / Fleetguard / MANN / WIX / Sakura / HIFI / Hengst / Bosch / Fram…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Duplicate warning */}
      {!dismissed && data?.duplicate && (
        <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">Такая позиция уже есть в CRM</div>
              <div className="text-muted-foreground mt-1">
                {data.duplicate.name}
                {data.duplicate.article ? ` • арт. ${data.duplicate.article}` : ""}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Остаток: <span className="font-medium text-foreground">{data.duplicate.stock}</span>
                {data.duplicate.storage_location ? ` • ${data.duplicate.storage_location}` : ""}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7"
                onClick={() => onOpenDuplicate?.(data.duplicate!.id)}
              >
                ✅ Пополнить остаток
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Article not found */}
      {!dismissed && ai && notFound && (
        <div className="rounded-md border border-red-500/50 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
            <div className="flex-1">
              <div className="font-medium text-red-800 dark:text-red-300">Артикул не найден в официальных каталогах</div>
              <div className="text-xs text-muted-foreground mt-1">
                Проверьте правильность артикула и производителя. AI не имеет права придумывать совместимость.
              </div>
              {ai.note && <div className="text-xs mt-1 italic text-muted-foreground">{ai.note}</div>}
              <div className="flex gap-2 mt-2">
                {onMoveToDeadstock && (
                  <Button size="sm" variant="outline" className="h-7" onClick={onMoveToDeadstock}>
                    В склад неликвида
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setDismissed(true)}>Скрыть</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main result */}
      {!dismissed && ai && !notFound && (
        <div className="space-y-2">
          {/* Trust badge */}
          {trust && (
            <div className={`rounded-md border px-3 py-2 text-xs flex items-start gap-2 ${trust.className}`}>
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{trust.icon} {trust.label}</div>
                {ai.sources.length > 0 && (
                  <div className="mt-1 opacity-80">
                    Источники: {ai.sources.map((s) => s.name).join(", ")}
                  </div>
                )}
                {ai.trust_reason && <div className="mt-0.5 opacity-80">{ai.trust_reason}</div>}
              </div>
            </div>
          )}

          {/* Block 1: Official info */}
          {ai.official_info && (
            <div className="rounded-md border bg-card px-3 py-2 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                Официальная информация
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {(ai.official_info.manufacturer_ru || ai.official_info.manufacturer_en) && <div>Производитель: <span className="text-foreground">{ai.official_info.manufacturer_ru || ai.official_info.manufacturer_en}</span></div>}
                {(ai.official_info.name_ru || ai.official_info.name_en) && <div>Наименование: <span className="text-foreground">{ai.official_info.name_ru || ai.official_info.name_en}</span></div>}
                {ai.official_info.name_en && ai.official_info.name_ru && <div className="italic opacity-70">EN: {ai.official_info.name_en}</div>}
                {ai.official_info.part_type_ru && <div>Тип: <span className="text-foreground">{ai.official_info.part_type_ru}</span></div>}
                {ai.article_normalized && <div>Артикул: <span className="text-foreground font-mono">{ai.article_normalized}</span></div>}
                {ai.official_info.description_ru && <div className="text-foreground">{ai.official_info.description_ru}</div>}
              </div>
              {ai.official_info.oems?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">OEM-номера:</div>
                  <div className="flex flex-wrap gap-1">
                    {ai.official_info.oems.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                  </div>
                </div>
              )}
              {ai.official_info.cross_numbers?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Кросс-номера:</div>
                  <div className="flex flex-wrap gap-1">
                    {ai.official_info.cross_numbers.map((c) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Block 2: Catalog compatibility */}
          {ai.catalog_compatibility?.length > 0 && (
            <div className="rounded-md border bg-card px-3 py-2 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                Совместимость по каталогу
                <Badge variant="outline" className="text-xs ms-auto">{ai.catalog_compatibility.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {ai.catalog_compatibility.slice(0, 30).map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {c.brand} {c.model}
                    {c.years ? ` • ${c.years}` : ""}
                    {c.engine ? ` • ${c.engine}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Block 3: Recommended compatibility — user selects */}
          <div className="rounded-md border bg-card px-3 py-2 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              Рекомендованная совместимость
              {ai.company_equipment?.length > 0 && (
                <Badge variant="outline" className="text-xs ms-auto">
                  Выбрано: {selectedIds.size} / {ai.company_equipment.length}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Отметьте технику, к которой действительно относится эта позиция. AI не выбирает за вас.
            </div>
            {ai.company_equipment?.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setSelectedIds(new Set(ai.company_equipment.map((e) => e.id)))}
                  >
                    Выбрать все
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Снять всё
                  </Button>
                </div>
                <div className="space-y-1">
                  {ai.company_equipment.map((e) => {
                    const label = [e.brand, e.model].filter(Boolean).join(" ") + (e.plate_number ? ` • ${e.plate_number}` : "");
                    const checked = selectedIds.has(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-start gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={() => toggleId(e.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span>{label}</span>
                            {e.confirmation_type && (
                              <Badge
                                variant={e.confirmation_type === "OEM" ? "default" : "secondary"}
                                className="text-[10px] h-4 px-1.5"
                              >
                                {e.confirmation_type}
                              </Badge>
                            )}
                            {typeof e.sources_count === "number" && e.sources_count > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                • подтв.: {e.sources_count}
                              </span>
                            )}
                          </div>
                          {(e.sources && e.sources.length > 0
                            ? e.sources.join(", ")
                            : e.source) && (
                            <div className="text-xs text-muted-foreground">
                              Источник: {e.sources && e.sources.length > 0 ? e.sources.join(", ") : e.source}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-start gap-1">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>Совместимость с техникой компании не найдена.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => { setDismissed(true); setData(null); }}
                  >
                    Добавить совместимость вручную
                  </Button>
                  {onMoveToDeadstock && (
                    <Button size="sm" variant="outline" className="h-7" onClick={onMoveToDeadstock}>
                      Переместить в склад неликвида
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* Purchase history */}
          {data?.price && (
            <div className="text-xs text-muted-foreground px-1">
              Последняя закупка: {new Date(data.price.last_at).toLocaleDateString("ru-RU")}
              {" • "}
              <span className="text-foreground">{data.price.last_price.toLocaleString("ru-RU")} ₽</span>
              {data.price.last_supplier ? ` • ${data.price.last_supplier}` : ""}
              {data.price.avg_price ? ` • средняя ${Math.round(data.price.avg_price).toLocaleString("ru-RU")} ₽` : ""}
              {" • закупок: "}{data.price.purchase_count}
            </div>
          )}

          {ai.note && <div className="text-xs text-muted-foreground italic px-1">{ai.note}</div>}

          <div className="flex flex-wrap gap-2">
            {ai.official_info && (
              <Button size="sm" onClick={applyOfficial} className="h-7">
                Принять рекомендации{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setDismissed(true); setData(null); }}>
              Не принимать
            </Button>
            {noCompany && onMoveToDeadstock && (
              <Button size="sm" variant="outline" className="h-7" onClick={onMoveToDeadstock}>
                В склад неликвида
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
