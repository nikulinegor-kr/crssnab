import { printHtml } from "@/lib/printHtml";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Tag, Printer } from "lucide-react";

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string | null;
  applicant: string | null;
}

export function LabelPrintDialog({ open, onOpenChange, description, applicant }: LabelPrintDialogProps) {
  const { toast } = useToast();

  const labelLines = [
    "ООО САХАРЕСУРС",
    "г. Нерюнгри",
    "Тел. +79231019944",
    applicant || "",
    description || "",
  ].filter(Boolean);
  const labelText = labelLines.join("\n");

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Скопировано", description: label });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const handlePrint = () => {
    printHtml(`
      <html>
        <head>
          <title>Этикетка</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .label { border: 1px solid #ccc; padding: 16px; max-width: 300px; margin: 0 auto; text-align: center; }
            .line { font-size: 13px; margin-bottom: 4px; word-break: break-word; }
            .line:first-child { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="label">
            ${labelLines.map((l) => `<div class="line">${escapeHtml(l)}</div>`).join("")}
          </div>
        </body>
      </html>
    `);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Печать этикетки
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Название заявки</Label>
            <div className="flex gap-2">
              <Input readOnly value={description || "—"} className="bg-muted/50" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(description || "", "Название заявки скопировано")}
                disabled={!description}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Заявитель</Label>
            <div className="flex gap-2">
              <Input readOnly value={applicant || "—"} className="bg-muted/50" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(applicant || "", "Заявитель скопирован")}
                disabled={!applicant}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Формат для этикетки</Label>
            <div className="rounded-md border bg-muted/50 p-3 text-center text-sm leading-relaxed">
              {labelLines.map((l, i) => (
                <div key={i} className={i === 0 ? "font-semibold" : undefined}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => copyToClipboard(labelText, "Формат этикетки скопирован")}
            disabled={!description}
          >
            <Copy className="h-4 w-4" />
            Копировать этикетку
          </Button>
          <Button className="gap-2" onClick={handlePrint} disabled={!description}>
            <Printer className="h-4 w-4" />
            Печать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
