import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Tag } from "lucide-react";

export interface BulkLabelItem {
  id: string;
  name: string | null;
  article: string | null;
  manufacturer: string | null;
  storage_location?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkLabelItem[];
}

// Niimbot B1 supported common thermal label sizes
const SIZES = [
  { id: "50x30", label: "50 × 30 мм", w: 50, h: 30, nameSize: 10, textSize: 8 },
  { id: "40x30", label: "40 × 30 мм", w: 40, h: 30, nameSize: 9, textSize: 7 },
  { id: "50x40", label: "50 × 40 мм", w: 50, h: 40, nameSize: 11, textSize: 8 },
  { id: "30x20", label: "30 × 20 мм", w: 30, h: 20, nameSize: 7, textSize: 6 },
] as const;

export function BulkPartLabelPrintDialog({ open, onOpenChange, items }: Props) {
  const [sizeId, setSizeId] = useState<string>("50x30");
  const [showManufacturer, setShowManufacturer] = useState(true);
  const [showStorage, setShowStorage] = useState(true);
  const [copies, setCopies] = useState<1 | 2 | 3>(1);

  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const handlePrint = () => {
    if (!items.length) return;
    const w = window.open("", "_blank");
    if (!w) return;

    const labelHtml = items
      .flatMap((it) => Array.from({ length: copies }, () => it))
      .map((it) => {
        const name = escapeHtml(it.name || "");
        const article = it.article ? `<div class="row">Арт.: ${escapeHtml(it.article)}</div>` : "";
        const mfr = showManufacturer && it.manufacturer ? `<div class="row">${escapeHtml(it.manufacturer)}</div>` : "";
        const stor = showStorage && it.storage_location ? `<div class="row">Место: ${escapeHtml(it.storage_location)}</div>` : "";
        return `<div class="label"><div class="name">${name}</div>${article}${mfr}${stor}</div>`;
      })
      .join("");

    w.document.write(`
      <html>
        <head>
          <title>Этикетки (${items.length * copies})</title>
          <style>
            @page {
              size: ${size.w}mm ${size.h}mm;
              margin: 0;
            }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: -apple-system, "Segoe UI", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label {
              width: ${size.w}mm;
              height: ${size.h}mm;
              padding: 1.2mm 1.5mm;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: center;
              page-break-after: always;
              break-after: page;
            }
            .label:last-child { page-break-after: auto; break-after: auto; }
            .name {
              font-size: ${size.nameSize}pt;
              font-weight: 700;
              line-height: 1.15;
              word-break: break-word;
              margin-bottom: 0.6mm;
              /* clamp to 2 lines */
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .row {
              font-size: ${size.textSize}pt;
              line-height: 1.2;
              color: #000;
              word-break: break-word;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            /* Preview screen frame */
            @media screen {
              body { background: #eee; padding: 16px; }
              .label {
                background: white;
                border: 1px dashed #999;
                margin: 0 auto 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
              }
            }
          </style>
        </head>
        <body>
          ${labelHtml}
          <script>
            window.onload = () => { setTimeout(() => window.print(), 250); };
          </script>
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
            Массовая печать этикеток
          </DialogTitle>
          <DialogDescription>
            Печать {items.length} {items.length === 1 ? "позиции" : "позиций"} • Niimbot B1 (термо)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Размер этикетки</Label>
            <RadioGroup value={sizeId} onValueChange={setSizeId} className="grid grid-cols-2 gap-2">
              {SIZES.map((s) => (
                <label
                  key={s.id}
                  htmlFor={`sz-${s.id}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={s.id} id={`sz-${s.id}`} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Копий каждой этикетки</Label>
            <RadioGroup value={String(copies)} onValueChange={(v) => setCopies(Number(v) as 1 | 2 | 3)} className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <label
                  key={n}
                  htmlFor={`c-${n}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={String(n)} id={`c-${n}`} />
                  <span className="text-sm">×{n}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Содержимое этикетки</Label>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showManufacturer} onCheckedChange={(v) => setShowManufacturer(!!v)} />
                Производитель
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={showStorage} onCheckedChange={(v) => setShowStorage(!!v)} />
                Место хранения
              </label>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border p-2 text-xs text-muted-foreground">
            Итого будет напечатано: <span className="font-medium text-foreground">{items.length * copies}</span> этикеток.
            В диалоге печати выберите принтер <span className="font-medium text-foreground">Niimbot B1</span> и убедитесь,
            что размер бумаги совпадает с выбранным ({size.label}).
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button className="gap-2" onClick={handlePrint} disabled={!items.length}>
            <Printer className="h-4 w-4" />
            Печать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
