import { FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { EditableTable } from "@/components/appendix/EditableTable";
import { ExportAppendixButton } from "@/components/appendix/ExportAppendixButton";

const Appendix = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const months = [
    { value: 1, label: "Январь" },
    { value: 2, label: "Февраль" },
    { value: 3, label: "Март" },
    { value: 4, label: "Апрель" },
    { value: 5, label: "Май" },
    { value: 6, label: "Июнь" },
    { value: 7, label: "Июль" },
    { value: 8, label: "Август" },
    { value: 9, label: "Сентябрь" },
    { value: 10, label: "Октябрь" },
    { value: 11, label: "Ноябрь" },
    { value: 12, label: "Декабрь" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Приложение</h1>
            <p className="text-muted-foreground">Редактируемая таблица с хранением по месяцам</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ExportAppendixButton month={selectedMonth} year={selectedYear} />
        </div>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="sheet1" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="sheet1">Книга 1</TabsTrigger>
            <TabsTrigger value="sheet2">Книга 2</TabsTrigger>
          </TabsList>

          <TabsContent value="sheet1">
            <EditableTable 
              month={selectedMonth} 
              year={selectedYear} 
              sheetType="sheet1" 
            />
          </TabsContent>

          <TabsContent value="sheet2">
            <EditableTable 
              month={selectedMonth} 
              year={selectedYear} 
              sheetType="sheet2" 
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Appendix;
