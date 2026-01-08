import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, FileText, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AIAnalytics = () => {
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("deadline");
  const [loading, setLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"weekly" | "monthly">("weekly");
  
  const [deadlinePrediction, setDeadlinePrediction] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [predictiveAnalysis, setPredictiveAnalysis] = useState<string | null>(null);

  const getOrganizationId = () => {
    if (isDemoMode) return "demo-org";
    return localStorage.getItem("currentOrganizationId");
  };

  const runAnalysis = async (type: string) => {
    const organizationId = getOrganizationId();
    if (!organizationId) {
      toast({
        title: "Ошибка",
        description: "Организация не выбрана",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analytics", {
        body: { 
          type, 
          organizationId,
          period: type === "report-generation" ? reportPeriod : undefined
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Ошибка AI",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      switch (type) {
        case "deadline-prediction":
          setDeadlinePrediction(data.analysis);
          break;
        case "report-generation":
          setGeneratedReport(data.analysis);
          break;
        case "predictive-analytics":
          setPredictiveAnalysis(data.analysis);
          break;
      }

      toast({
        title: "Анализ завершён",
        description: "AI-анализ успешно выполнен",
      });
    } catch (error) {
      console.error("AI Analytics error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить анализ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Простой рендер markdown
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        }
        if (line.trim() === '') {
          return <br key={i} />;
        }
        return <p key={i} className="mb-2">{line}</p>;
      });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Аналитика</h1>
          <p className="text-muted-foreground">Интеллектуальный анализ заявок</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="deadline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Прогноз сроков</span>
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Генерация отчётов</span>
          </TabsTrigger>
          <TabsTrigger value="predictive" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Предиктивная аналитика</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deadline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Прогноз сроков выполнения
              </CardTitle>
              <CardDescription>
                AI анализирует историю заявок и прогнозирует время выполнения для новых заявок
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => runAnalysis("deadline-prediction")} 
                disabled={loading}
                className="mb-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализ...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Получить прогноз
                  </>
                )}
              </Button>

              {deadlinePrediction && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none dark:prose-invert">
                  {renderMarkdown(deadlinePrediction)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Генерация отчётов
              </CardTitle>
              <CardDescription>
                Автоматическое создание еженедельных и ежемесячных отчётов по заявкам
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as "weekly" | "monthly")}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Еженедельный</SelectItem>
                    <SelectItem value="monthly">Ежемесячный</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => runAnalysis("report-generation")} 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Создать отчёт
                    </>
                  )}
                </Button>
              </div>

              {generatedReport && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none dark:prose-invert">
                  {renderMarkdown(generatedReport)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictive">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Предиктивная аналитика
              </CardTitle>
              <CardDescription>
                Прогноз нагрузки и рекомендации по распределению ресурсов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => runAnalysis("predictive-analytics")} 
                disabled={loading}
                className="mb-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализ...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Запустить анализ
                  </>
                )}
              </Button>

              {predictiveAnalysis && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none dark:prose-invert">
                  {renderMarkdown(predictiveAnalysis)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAnalytics;
