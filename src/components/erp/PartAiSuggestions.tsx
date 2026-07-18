import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Info, Camera, Wand2, X } from "lucide-react";

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
    manufacturer: string | null;
    name: string | null;
    category: string | null;
    cross_numbers: string[];
    analogs: string[];
    confidence: string | null;
    note: string | null;
    suggested_equipment: Array<{ id: string; brand: string | null; model: string | null; plate_number: string | null; year: number | null }>;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const key = useMemo(
    () => JSON.stringify([article.trim(), [...crossNumbers].sort(), name.trim(), (manufacturer ?? "").trim()]),
    [article, crossNumbers, name, manufacturer]
  );

  const runAnalysis = async (extras?: { image_base64?: string; image_mime?: string; force?: boolean }) => {
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
          excludeId,
          image_base64: extras?.image_base64,
          image_mime: extras?.image_mime,
        },
      });
      if (error) throw error;
      const suggestion = res as PartAiSuggestion;
      setData(suggestion);
      // Auto-fill from photo vision
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

  // Auto-run on debounced text change
  useEffect(() => {
    const hasInput = article.trim().length >= 2 || crossNumbers.length > 0 || name.trim().length >= 3;
    if (!hasInput || !orgId) {
      setData(null);
      return;
    }
    if (key === lastKeyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastKeyRef.current = key;
      runAnalysis();
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, orgId, kind]);

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

  const applyAi = () => {
    if (!data?.ai) return;
    onAccept({
      manufacturer: data.ai.manufacturer ?? undefined,
      name: data.ai.name ?? undefined,
      category: data.ai.category ?? undefined,
      cross_numbers: data.ai.cross_numbers?.length ? data.ai.cross_numbers : undefined,
      equipment_ids: data.ai.suggested_equipment?.map((e) => e.id),
    });
  };

  const noCompat = !!data?.ai && (!data.ai.suggested_equipment || data.ai.suggested_equipment.length === 0);
  const hasInput = article.trim().length >= 2 || crossNumbers.length > 0 || name.trim().length >= 3;

  return (
    <div className="space-y-2">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI помощник</span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 gap-1"
            disabled={loading || !hasInput}
            onClick={() => { lastKeyRef.current = ""; runAnalysis(); }}
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
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {photoUrl && (
        <div className="relative inline-block">
          <img src={photoUrl} alt="Фото детали" className="max-h-32 rounded-md border" />
          <button
            type="button"
            onClick={() => setPhotoUrl(null)}
            className="absolute -top-2 -right-2 rounded-full bg-background border p-0.5 shadow"
            aria-label="Убрать фото"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          AI анализирует…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

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
              {data.duplicate.equipment.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.duplicate.equipment.slice(0, 5).map((e) => (
                    <Badge key={e.id} variant="secondary" className="text-xs">
                      {[e.brand, e.model].filter(Boolean).join(" ")}
                      {e.plate_number ? ` • ${e.plate_number}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7"
                onClick={() => {
                  if (onOpenDuplicate) onOpenDuplicate(data.duplicate!.id);
                  else {
                    window.dispatchEvent(new CustomEvent("open-part-detail", {
                      detail: { kind, id: data.duplicate!.id },
                    }));
                  }
                }}
              >
                ✅ Пополнить остаток
              </Button>
            </div>
          </div>
        </div>
      )}

      {!dismissed && data?.ai && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">AI-рекомендации</span>
            {data.ai.confidence && (
              <Badge variant="outline" className="text-xs">
                {data.ai.confidence === "high" ? "высокая уверенность" : data.ai.confidence === "medium" ? "средняя" : "низкая"}
              </Badge>
            )}
          </div>

          {(data.ai.manufacturer || data.ai.name) && (
            <div className="text-xs text-muted-foreground">
              {data.ai.manufacturer && <>Производитель: <span className="text-foreground">{data.ai.manufacturer}</span> </>}
              {data.ai.name && <>• Название: <span className="text-foreground">{data.ai.name}</span></>}
            </div>
          )}

          {data.ai.suggested_equipment.length > 0 ? (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Совместимая техника (заполнено автоматически):</div>
              <div className="flex flex-wrap gap-1">
                {data.ai.suggested_equipment.map((e) => (
                  <Badge key={e.id} variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                    {[e.brand, e.model].filter(Boolean).join(" ")}
                    {e.plate_number ? ` • ${e.plate_number}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-1">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  ⚠️ Совместимость с техникой компании не найдена. Добавьте совместимость вручную ниже
                  или переместите позицию в склад неликвида.
                </div>
              </div>
            </div>
          )}

          {data.ai.cross_numbers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Кросс-номера ({data.ai.cross_numbers.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {data.ai.cross_numbers.slice(0, 10).map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.ai.analogs.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Аналоги: {data.ai.analogs.slice(0, 5).join(", ")}
            </div>
          )}

          {data.price && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Последняя закупка: {new Date(data.price.last_at).toLocaleDateString("ru-RU")}
              {" • "}
              <span className="text-foreground">{data.price.last_price.toLocaleString("ru-RU")} ₽</span>
              {data.price.last_supplier ? ` • ${data.price.last_supplier}` : ""}
              {data.price.avg_price ? ` • средняя ${Math.round(data.price.avg_price).toLocaleString("ru-RU")} ₽` : ""}
              {" • закупок: "}{data.price.purchase_count}
              {data.price.suppliers.length > 1 && (
                <> • поставщики: {data.price.suppliers.slice(0, 3).join(", ")}</>
              )}
            </div>
          )}

          {data.ai.note && (
            <div className="text-xs text-muted-foreground italic">{data.ai.note}</div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={applyAi} className="h-7">
              Принять рекомендации
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setDismissed(true); setData(null); }}>
              Не принимать
            </Button>
            {noCompat && onMoveToDeadstock && (
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
