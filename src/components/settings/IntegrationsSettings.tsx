import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileSpreadsheet, Loader2, CheckCircle2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface IntegrationsSettingsProps {
  organizationId: string;
}

export const IntegrationsSettings = ({ organizationId }: IntegrationsSettingsProps) => {
  const { toast } = useToast();
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleImport = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ID таблицы Google Sheets",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("import-sheets-data", {
        body: {
          spreadsheetId,
          organizationId,
        },
      });

      if (error) throw error;

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "create",
        _entity_type: "integration",
        _new_values: {
          type: "google_sheets_import",
          spreadsheet_id: spreadsheetId,
          imported_count: data?.importedCount || 0,
        },
      });

      toast({
        title: "Успешно",
        description: `Импортировано ${data?.importedCount || 0} заявок`,
      });

      setSpreadsheetId("");
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось импортировать данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);

    try {
      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Convert to CSV
      if (!requests || requests.length === 0) {
        toast({
          title: "Нет данных",
          description: "Нет заявок для экспорта",
          variant: "destructive",
        });
        return;
      }

      const headers = Object.keys(requests[0]);
      const csvContent = [
        headers.join(","),
        ...requests.map((row) =>
          headers.map((header) => JSON.stringify(row[header] || "")).join(",")
        ),
      ].join("\n");

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `requests_${new Date().toISOString()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await supabase.rpc("log_audit_event", {
        _organization_id: organizationId,
        _action: "create",
        _entity_type: "integration",
        _new_values: {
          type: "csv_export",
          exported_count: requests.length,
        },
      });

      toast({
        title: "Успешно",
        description: `Экспортировано ${requests.length} заявок`,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось экспортировать данные",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <CardTitle>Google Sheets</CardTitle>
          </div>
          <CardDescription>
            Импорт заявок из Google Таблиц и экспорт данных
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="spreadsheet-id">ID таблицы Google Sheets</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="spreadsheet-id"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                />
                <Button onClick={handleImport} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Импорт
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ID находится в URL таблицы между /d/ и /edit
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label>Экспорт заявок</Label>
                  <p className="text-xs text-muted-foreground">
                    Скачать все заявки в формате CSV
                  </p>
                </div>
                <Button onClick={handleExport} disabled={exportLoading} variant="outline">
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Экспорт CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Требования к таблице</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Первая строка должна содержать заголовки столбцов</li>
              <li>Обязательные колонки: request_number, description, request_date</li>
              <li>Таблица должна быть доступна по ссылке</li>
              <li>
                Service Account должен иметь доступ к таблице (добавьте email в настройки доступа)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Другие интеграции (Slack, Microsoft Teams, Zapier) будут доступны в следующих версиях
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Badge variant="outline">Slack</Badge>
              <Badge variant="outline">Microsoft Teams</Badge>
              <Badge variant="outline">Zapier</Badge>
              <Badge variant="outline">Webhook</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
