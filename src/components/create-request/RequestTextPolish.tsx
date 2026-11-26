import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  field: "description" | "applicant_justification";
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function RequestTextPolish({ field, value, disabled, onChange }: Props) {
  const [suggestion, setSuggestion] = useState<{ current: string; original: string; text: string } | null>(null);
  const [history, setHistory] = useState<{ original: string; applied: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const activeSuggestion = suggestion?.current === value ? suggestion : null;
  const activeHistory = history?.applied === value ? history : null;
  if (disabled) return null;

  async function improve() {
    if (pending.current || value.trim().length < 3) return;
    const controller = new AbortController();
    pending.current = controller;
    const original = activeSuggestion?.original ?? activeHistory?.original ?? value;
    const previous = activeSuggestion?.text ?? activeHistory?.applied;
    const limit = field === "description" ? 500 : 2000;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke("improve-description", {
        body: { description: original, field, previous: previous ?? null },
      });
      if (controller.signal.aborted) return;
      if (error || data?.error) {
        const ctx = (error as { context?: Response } | null)?.context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(data?.error || body?.error || "Не удалось улучшить текст");
      }
      const text = String(data?.improved ?? "").trim();
      if (!text || text.length > limit) throw new Error("ИИ вернул неподходящий вариант. Попробуйте ещё раз.");
      setSuggestion({ current: value, original, text });
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message || "Не удалось улучшить текст");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5"
          disabled={busy || value.trim().length < 3} onClick={() => void improve()}>
          {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
          {busy ? "Улучшаем…" : activeSuggestion || activeHistory ? "Переделать" : "Улучшить текст"}
        </Button>
        {activeHistory && <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={busy} onClick={() => {
          onChange(activeHistory.original);
          setHistory(null);
          setSuggestion(null);
          setError("");
        }}><RotateCcw aria-hidden="true" className="size-3.5" />Вернуть исходный</Button>}
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      {activeSuggestion && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3" aria-live="polite">
          <p className="text-xs font-medium text-muted-foreground">Вариант ИИ</p>
          <p className="whitespace-pre-wrap break-words text-sm">{activeSuggestion.text}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => {
              onChange(activeSuggestion.text);
              setHistory({ original: activeSuggestion.original, applied: activeSuggestion.text });
              setSuggestion(null);
            }}>Применить</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setSuggestion(null)}>Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
}
