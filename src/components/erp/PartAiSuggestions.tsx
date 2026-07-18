import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

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
}

interface Props {
  orgId: string;
  kind: "filter" | "spare";
  article: string;
  crossNumbers: string[];
  name: string;
  excludeId?: string;
  onAccept: (data: PartAiAccept) => void;
  onOpenDuplicate?: (id: string) => void;
  onMoveToDeadstock?: () => void;
}

export function PartAiSuggestions({
  orgId,
  kind,
  article,
  crossNumbers,
  name,
  excludeId,
  onAccept,
  onOpenDuplicate,
  onMoveToDeadstock,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PartAiSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");

  const key = useMemo(
    () => JSON.stringify([article.trim(), [...crossNumbers].sort(), name.trim()]),
    [article, crossNumbers, name]
  );

  useEffect(() => {
    const hasInput = article.trim().length >= 2 || crossNumbers.length > 0 || name.trim().length >= 3;
    if (!hasInput || !orgId) {
      setData(null);
      return;
    }
    if (key === lastKeyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      lastKeyRef.current = key;
      setLoading(true);
      setError(null);
      try {
        const { data: res, error } = await supabase.functions.invoke("analyze-part", {
          body: {
            orgId,
            kind,
            article: article.trim() || undefined,
            cross_number: crossNumbers[0] || undefined,
            name: name.trim() || undefined,
            excludeId,
          },
        });
        if (error) throw error;
        setData(res as PartAiSuggestion);
      } catch (e: any) {
        setError(e?.message ?? "Ошибка AI");
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, orgId, kind, article, crossNumbers, name, excludeId]);

  const hasInput = article.trim().length >= 2 || crossNumbers.length > 0 || name.trim().length >= 3;
  if (!hasInput) return null;

  if (loading && !data) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        AI анализирует…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const applyAi = () => {
    if (!data.ai) return;
    onAccept({
      manufacturer: data.ai.manufacturer ?? undefined,
      name: data.ai.name ?? undefined,
      category: data.ai.category ?? undefined,
      cross_numbers: data.ai.cross_numbers?.length ? data.ai.cross_numbers : undefined,
      equipment_ids: data.ai.suggested_equipment?.map((e) => e.id),
    });
  };

  const noCompat = data.ai && (!data.ai.suggested_equipment || data.ai.suggested_equipment.length === 0);

  return (
    <div className="space-y-2">
      {data.duplicate && (
        <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">Такая запчасть уже существует</div>
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
              {onOpenDuplicate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7"
                  onClick={() => onOpenDuplicate(data.duplicate!.id)}
                >
                  Пополнить остаток
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {data.ai && (
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
              <div className="text-xs text-muted-foreground mb-1">Подходит:</div>
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
            <div className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
              <Info className="h-3.5 w-3.5 mt-0.5" />
              Не удалось определить совместимость с техникой CRM.
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
              Возможно, вы имели в виду: {data.ai.analogs.slice(0, 5).join(", ")}
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
            </div>
          )}

          {data.ai.note && (
            <div className="text-xs text-muted-foreground italic">{data.ai.note}</div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={applyAi} className="h-7">
              Принять рекомендации
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
