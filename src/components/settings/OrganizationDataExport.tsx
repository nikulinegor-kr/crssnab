import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportFormats, exportOrganizationData, type ExportFormat } from "@/lib/organizationDataExport";

export function OrganizationDataExport({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [progress, setProgress] = useState("");

  const [format, setFormat] = useState<ExportFormat>("XLSX");

  async function download() {
    if (progress) return;
    setProgress("Проверяем доступ");
    try {
      const { unavailable } = await exportOrganizationData(organizationId, format, setProgress);
      toast({
        title: "Выгрузка готова",
        description: unavailable ? `В архиве есть список недоступных вложений: ${unavailable}.` : "Файл сохранён через загрузки браузера.",
      });
    } catch (error) {
      toast({ title: "Выгрузка не выполнена", description: (error as { message?: string })?.message, variant: "destructive" });
    } finally {
      setProgress("");
    }
  }

  return (
    <div className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">Выгрузка данных организации</h3>
        <p className="mt-1 text-sm text-muted-foreground">В ZIP-архив войдут данные в выбранном формате, счета, договоры и другие доступные файлы организации.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Формат данных
          <select className="h-10 rounded-md border border-input bg-background px-3" value={format}
            disabled={Boolean(progress)} onChange={event => setFormat(event.target.value as ExportFormat)}>
            {exportFormats.map(option => <option key={option}>{option}</option>)}
          </select>
        </label>
        <Button type="button" disabled={Boolean(progress)} onClick={() => void download()}>
          <Download className="mr-2 size-4" />Скачать архив
        </Button>
      </div>
      {progress && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{progress}</p>}
    </div>
  );
}
