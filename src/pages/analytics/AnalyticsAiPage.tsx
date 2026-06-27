import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilter, Period, presetPeriods } from "@/components/analytics/PeriodFilter";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Report = {
  id: string;
  period_from: string;
  period_to: string;
  summary: string | null;
  content: string;
  created_at: string;
};

export default function AnalyticsAiPage() {
  const { currentOrgId } = useCurrentOrganization();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [active, setActive] = useState<Report | null>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    supabase
      .from("ai_analytics_reports")
      .select("id,period_from,period_to,summary,content,created_at")
      .eq("organization_id", currentOrgId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const list = (data as Report[]) ?? [];
        setReports(list);
        if (list.length && !active) setActive(list[0]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  const generate = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analytics-ai", {
        body: {
          organization_id: currentOrgId,
          period_from: format(period.from, "yyyy-MM-dd"),
          period_to: format(period.to, "yyyy-MM-dd"),
        },
      });
      if (error) throw error;
      const report: Report = data.report;
      setReports((prev) => [report, ...prev]);
      setActive(report);
      toast({ title: "Готово", description: "Отчёт сформирован" });
    } catch (e: any) {
      const msg = e?.message ?? "Не удалось сформировать отчёт";
      toast({
        title: "Ошибка",
        description: msg.includes("402")
          ? "Закончились кредиты Lovable AI. Пополните баланс в настройках workspace."
          : msg.includes("429")
            ? "Слишком много запросов. Попробуйте позже."
            : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> AI Аналитик
          </h1>
          <p className="text-sm text-muted-foreground">
            Управленческие выводы и рекомендации на основе данных CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Button onClick={generate} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Сформировать отчёт
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 py-1">
            История отчётов
          </div>
          <div className="space-y-1 max-h-[70vh] overflow-auto">
            {reports.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground">
                Отчётов пока нет. Нажмите «Сформировать».
              </div>
            )}
            {reports.map((r) => {
              const isActive = active?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setActive(r)}
                  className={`w-full text-left rounded px-2 py-2 hover:bg-muted/40 text-sm ${
                    isActive ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="font-medium">
                    {format(new Date(r.period_from), "dd.MM.yy")} —{" "}
                    {format(new Date(r.period_to), "dd.MM.yy")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM, HH:mm", { locale: ru })}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          {active ? (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{active.content}</ReactMarkdown>
            </article>
          ) : (
            <div className="text-center text-muted-foreground py-16">
              {loading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                  AI анализирует данные…
                </>
              ) : (
                "Выберите период и сформируйте отчёт"
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
