import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Tag, Printer } from "lucide-react";

interface PartLabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null;
  article: string | null;
  manufacturer: string | null;
  storageLocation?: string | null;
}

export function PartLabelPrintDialog({
  open,
  onOpenChange,
  name,
  article,
  manufacturer,
  storageLocation,
}: PartLabelPrintDialogProps) {
  const { toast } = useToast();

  const lines = [
    name || "",
    article ? `Арт.: ${article}` : "",
    manufacturer || "",
    storageLocation ? `Место: ${storageLocation}` : "",
  ].filter(Boolean);
  const labelText = lines.join("\n");

  const copy = async (text: string, label: string) => {
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
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Этикетка</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .label { border: 1px solid #ccc; padding: 16px; max-width: 320px; }
            .name { font-size: 14px; font-weight: 600; margin-bottom: 6px; word-break: break-word; }
            .row { font-size: 12px; color: #333; margin-bottom: 3px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="name">${escapeHtml(name || "")}</div>
            ${article ? `<div class="row">Арт.: ${escapeHtml(article)}</div>` : ""}
            ${manufacturer ? `<div class="row">${escapeHtml(manufacturer)}</div>` : ""}
            ${storageLocation ? `<div class="row">Место: ${escapeHtml(storageLocation)}</div>` : ""}
          </div>
          <script>window.onload = () => { setTimeout(() => window.print(), 200); };</script>
        </body>
      </html>
    `);
    w.document.close();
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
            <Label className="text-xs">Наименование</Label>
            <div className="flex gap-2">
              <Input readOnly value={name || "—"} className="bg-muted/50" />
              <Button type="button" variant="outline" size="icon"
                onClick={() => copy(name || "", "Наименование скопировано")} disabled={!name}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Артикул</Label>
            <div className="flex gap-2">
              <Input readOnly value={article || "—"} className="bg-muted/50" />
              <Button type="button" variant="outline" size="icon"
                onClick={() => copy(article || "", "Артикул скопирован")} disabled={!article}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Производитель</Label>
            <div className="flex gap-2">
              <Input readOnly value={manufacturer || "—"} className="bg-muted/50" />
              <Button type="button" variant="outline" size="icon"
                onClick={() => copy(manufacturer || "", "Производитель скопирован")} disabled={!manufacturer}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {storageLocation !== undefined && (
            <div className="space-y-1.5">
              <Label className="text-xs">Место хранения</Label>
              <div className="flex gap-2">
                <Input readOnly value={storageLocation || "—"} className="bg-muted/50" />
                <Button type="button" variant="outline" size="icon"
                  onClick={() => copy(storageLocation || "", "Место хранения скопировано")} disabled={!storageLocation}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Формат для этикетки</Label>
            <div className="flex gap-2">
              <Input readOnly value={labelText} className="bg-muted/50 text-xs" />
              <Button type="button" variant="outline" size="icon"
                onClick={() => copy(labelText, "Формат этикетки скопирован")} disabled={!name}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
          <Button variant="outline" className="gap-2"
            onClick={() => copy(labelText, "Формат этикетки скопирован")} disabled={!name}>
            <Copy className="h-4 w-4" />
            Копировать
          </Button>
          <Button className="gap-2" onClick={handlePrint} disabled={!name}>
            <Printer className="h-4 w-4" />
            Печать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
