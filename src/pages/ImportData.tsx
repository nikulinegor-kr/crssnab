import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";

interface ParsedRequest {
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  payment_percentage: number;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
}

const ImportData = () => {
  const [sheetsData, setSheetsData] = useState("");
  const [selectedYear, setSelectedYear] = useState("2019");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  const years = ["2019", "2020", "2021", "2022", "2023", "2024"];

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === "") return null;
    
    // Format: DD.MM.YY or DD.MM.YYYY
    const parts = dateStr.split(".");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      let year = parts[2];
      
      // Convert 2-digit year to 4-digit
      if (year.length === 2) {
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      }
      
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const parsePayment = (paymentStr: string): number => {
    if (!paymentStr) return 0;
    const match = paymentStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const parseTableRow = (row: string): ParsedRequest | null => {
    // Split by | and filter empty cells
    const cells = row.split("|").map(c => c.trim()).filter(c => c && c !== "---");
    
    if (cells.length < 8) return null;

    // Extract date and description from first cell (format: MM/DD.MM.YYYY Description)
    const firstCell = cells[0];
    const match = firstCell.match(/(\d+)\/(\d+\.\d+\.\d+)\s+(.+)/);
    
    if (!match) return null;

    const requestNumber = match[1];
    const dateStr = match[2];
    const description = match[3];

    return {
      request_number: requestNumber,
      request_date: parseDate(dateStr) || new Date().toISOString().split("T")[0],
      description: description,
      status: cells[1] || "Новая",
      availability_delivery_time: cells[2] || null,
      contractor: cells[3] || null,
      invoice_number: cells[4] || null,
      payment_percentage: parsePayment(cells[5]),
      shipment_date: parseDate(cells[6]),
      delivery_date: parseDate(cells[7]),
      transport_company: cells[8] || null,
      waybill_number: cells[9] || null,
      comments: cells[10] || null,
    };
  };

  const handleImport = async (year: string) => {
    setImporting(true);
    try {
      const lines = sheetsData.split("\n").filter(line => line.includes("|"));
      const requests: ParsedRequest[] = [];

      for (const line of lines) {
        // Skip header rows
        if (line.includes("Заявка") || line.includes("---")) continue;
        
        const parsed = parseTableRow(line);
        if (parsed && parsed.request_date.startsWith(year)) {
          requests.push(parsed);
        }
      }

      if (requests.length === 0) {
        toast({
          title: "Нет данных",
          description: `Не найдено заявок за ${year} год`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("requests")
        .insert(requests);

      if (error) throw error;

      setImported({ ...imported, [year]: true });
      toast({
        title: "Успешно!",
        description: `Импортировано ${requests.length} заявок за ${year} год`,
      });
    } catch (error: any) {
      toast({
        title: "Ошибка импорта",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Импорт данных</h1>
            <p className="text-muted-foreground mt-1">Импорт заявок из Google Sheets по годам</p>
          </div>
          <FileSpreadsheet className="h-10 w-10 text-primary" />
        </div>

        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Вставьте данные таблицы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Скопируйте данные из Google Sheets и вставьте их в поле ниже в формате Markdown таблицы:
              </p>
              <Textarea
                placeholder="| Заявка | Статус | Наличие/ Сроки поставки | Контрагент | Счет | Оплата | ... |"
                value={sheetsData}
                onChange={(e) => setSheetsData(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle>Импорт по годам</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedYear} onValueChange={setSelectedYear}>
              <TabsList className="grid w-full grid-cols-6">
                {years.map((year) => (
                  <TabsTrigger key={year} value={year}>
                    {year}
                  </TabsTrigger>
                ))}
              </TabsList>

              {years.map((year) => (
                <TabsContent key={year} value={year} className="space-y-4 mt-4">
                  <div className="flex items-center justify-between p-6 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-lg">Заявки за {year} год</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {imported[year] 
                          ? "✓ Данные импортированы" 
                          : "Нажмите кнопку для импорта данных"}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleImport(year)}
                      disabled={importing || !sheetsData || imported[year]}
                      className="gap-2"
                    >
                      {imported[year] ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Импортировано
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {importing ? "Импорт..." : "Импортировать"}
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-none shadow-card bg-info/5 border-info/20">
          <CardContent className="p-6">
            <h3 className="font-semibold text-info mb-2">Инструкция по импорту</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Откройте Google Sheets таблицу</li>
              <li>Выделите все данные (включая заголовки)</li>
              <li>Скопируйте и вставьте в текстовое поле выше</li>
              <li>Выберите год для импорта</li>
              <li>Нажмите кнопку "Импортировать"</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportData;
