import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";

const ImportData = () => {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetRange, setSheetRange] = useState("Лист1!A:K");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const years = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];

  const handleImportFromSheets = async (year: string) => {
    if (!spreadsheetId) {
      toast({
        title: "Ошибка",
        description: "Введите ID таблицы Google Sheets",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-sheets-data', {
        body: {
          spreadsheetId,
          range: sheetRange,
          year,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Успешно",
          description: data.message,
        });
        setImported({ ...imported, [year]: true });
      } else {
        toast({
          title: "Нет данных",
          description: data.message,
        });
      }
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err.message || "Произошла ошибка при импорте",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Импорт данных</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Настройки Google Sheets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">ID таблицы Google Sheets</label>
              <Input
                placeholder="1abc...xyz"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Найдите ID в URL таблицы: docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Диапазон</label>
              <Input
                placeholder="Лист1!A:K"
                value={sheetRange}
                onChange={(e) => setSheetRange(e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Импорт по годам</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="2019" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                {years.map((year) => (
                  <TabsTrigger key={year} value={year}>
                    {year}
                  </TabsTrigger>
                ))}
              </TabsList>
              {years.map((year) => (
                <TabsContent key={year} value={year} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Импортируйте данные за {year} год из Google Sheets
                  </p>
                  <Button
                    onClick={() => handleImportFromSheets(year)}
                    disabled={importing || !spreadsheetId}
                    className="w-full"
                  >
                    {importing ? (
                      "Импорт..."
                    ) : imported[year] ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Импортировано
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Импортировать {year}
                      </>
                    )}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Инструкции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>1. Скопируйте ID вашей таблицы Google Sheets из URL</p>
            <p>2. Вставьте ID в поле выше</p>
            <p>3. Укажите диапазон ячеек (по умолчанию Лист1!A:K)</p>
            <p>4. Выберите год и нажмите "Импортировать"</p>
            <p className="text-sm text-muted-foreground mt-4">
              Примечание: Убедитесь, что сервисный аккаунт имеет доступ к таблице
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportData;
