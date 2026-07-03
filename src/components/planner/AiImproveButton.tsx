import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  value: string;
  onResult: (improved: string) => void;
  title?: string;
}

export function AiImproveButton({ value, onResult, title = "Улучшить с помощью AI" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const text = value.trim();
    if (text.length < 3) {
      toast.error("Введите текст", { description: "Нужно минимум 3 символа для улучшения" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-description", {
        body: { description: text },
      });
      if (error) throw error;
      if (data?.improved) {
        onResult(data.improved);
        toast.success("Текст улучшен");
      }
    } catch (e: any) {
      toast.error("Не удалось улучшить", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={loading}
      title={title}
      aria-label={title}
      className="shrink-0"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
    </Button>
  );
}
