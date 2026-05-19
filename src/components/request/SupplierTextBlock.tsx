import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Copy, ClipboardList, RefreshCw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  requestId: string;
  organizationId: string;
}

interface CombinedItem {
  name: string;
  quantity: number | null;
  unit?: string | null;
  article?: string | null;
  type_mark?: string | null;
}

const formatQty = (q: number | null | undefined, unit?: string | null) => {
  if (q == null) return "";
  const n = Number(q);
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${formatted} ${unit}` : formatted;
};

const buildText = (items: CombinedItem[], compact: boolean): string => {
  if (!items.length) return "";
  if (compact) {
    return items
      .map((it) => {
        const qty = formatQty(it.quantity, it.unit || "шт");
        const mark = it.type_mark ? ` ${it.type_mark}` : "";
        return `${it.name}${mark}${qty ? ` — ${qty}` : ""}`;
      })
      .join("\n");
  }
  return items
    .map((it) => {
      const qty = formatQty(it.quantity, it.unit || "шт");
      const mark = it.type_mark ? ` ${it.type_mark}` : "";
      const lines = [`${it.name}${mark}${qty ? ` — ${qty}` : ""}`];
      if (it.article) lines.push(`Артикул: ${it.article}`);
      return lines.join("\n");
    })
    .join("\n\n");
};

export const SupplierTextBlock = ({ requestId, organizationId }: Props) => {
  const { toast } = useToast();
  const [compact, setCompact] = useState(true);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["supplier-text-items", requestId],
    queryFn: async (): Promise<CombinedItem[]> => {
      const [reqItemsRes, statementRes] = await Promise.all([
        supabase
          .from("request_items")
          .select("name, quantity, article")
          .eq("request_id", requestId)
          .order("created_at", { ascending: true }),
        supabase
          .from("material_statement_items")
          .select("name, quantity, unit, type_mark")
          .eq("procurement_request_id", requestId)
          .eq("organization_id", organizationId),
      ]);

      const statementByName = new Map<string, any>();
      (statementRes.data || []).forEach((s: any) => {
        statementByName.set(s.name?.toLowerCase().trim(), s);
      });

      const reqItems = reqItemsRes.data || [];
      if (reqItems.length) {
        return reqItems.map((r: any) => {
          const match = statementByName.get(r.name?.toLowerCase().trim());
          return {
            name: r.name,
            quantity: r.quantity,
            article: r.article,
            unit: match?.unit,
            type_mark: match?.type_mark,
          };
        });
      }
      return (statementRes.data || []).map((s: any) => ({
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        type_mark: s.type_mark,
      }));
    },
  });

  const generated = useMemo(() => buildText(items, compact), [items, compact]);

  useEffect(() => {
    if (!edited) setText(generated);
  }, [generated, edited]);

  // Auto-height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 600)}px`;
  }, [text]);

  const handleCopy = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "Скопировано", description: "Текст готов к отправке поставщику" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setText(generated);
    setEdited(false);
    toast({ title: "Текст обновлён из материалов заявки" });
  };

  if (!items.length) return null;

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Ведомость материалов
            <span className="text-xs text-muted-foreground font-normal">
              · {items.length} поз.
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Компактно</span>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setEdited(true);
          }}
          placeholder="Текст для отправки поставщику..."
          className="min-h-[120px] resize-none font-mono text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {edited ? "Текст отредактирован вручную" : "Авто-генерация из материалов"}
          </p>
          <div className="flex items-center gap-2">
            {edited && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            )}
            <Button size="sm" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Скопировано" : "Скопировать"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
