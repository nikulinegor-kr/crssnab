import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportOrganizationData } from "@/lib/organizationDataExport";

export function OrganizationDataExport({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [progress, setProgress] = useState("");

  async function download(includeAttachments: boolean) {
    if (progress) return;
    setProgress("Проверяем доступ");
    try {
      const { unavailable } = await exportOrganizationData(organizationId, includeAttachments, setProgress);
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
        <p className="mt-1 text-sm text-muted-foreground">Заявки, поставщики, перевозки, задачи, ведомости и складские данные. Для копии файлов заявок выберите архив с вложениями.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(progress)} onClick={() => void download(false)}><Download className="mr-2 size-4" />Скачать JSON</Button>
        <Button type="button" variant="outline" disabled={Boolean(progress)} onClick={() => void download(true)}>Скачать ZIP с вложениями</Button>
      </div>
      {progress && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{progress}</p>}
    </div>
  );
}
