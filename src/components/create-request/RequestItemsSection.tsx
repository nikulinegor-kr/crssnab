import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSectionCard } from "./FormSectionCard";
import { Package, Plus, Trash2, ScanText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { recognizeInvoiceFile } from "@/lib/recognizeInvoice";
import { mergeRecognizedItems, normalizeRecognizedItems, type RequestItem } from "@/lib/invoiceAutofill";

export type { RequestItem } from "@/lib/invoiceAutofill";

interface RequestItemsSectionProps {
  items: RequestItem[];
  onItemsChange: (items: RequestItem[]) => void;
  disabled?: boolean;
  onInvoiceSelected?: (file: File) => void;
}

export const RequestItemsSection = ({
  items,
  onItemsChange,
  disabled = false,
  onInvoiceSelected,
}: RequestItemsSectionProps) => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addItem = () => {
    onItemsChange([...items, { article: "", name: "", quantity: 1, unit: "шт", price: null }]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RequestItem, value: string | number | null) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onItemsChange(updated);
  };

  const handleRecognizeInvoice = async (file: File) => {
    setIsRecognizing(true);
    try {
      const data = await recognizeInvoiceFile(file, "items");
      const recognized = normalizeRecognizedItems(data.items);
      const merged = mergeRecognizedItems(items, recognized);

      if (recognized.length) {
        onItemsChange(merged.items);
        onInvoiceSelected?.(file);
        if (data.preparedFile) onInvoiceSelected?.(data.preparedFile);
        toast({
          title: "Распознано",
          description: (merged.added
            ? `Добавлено позиций: ${merged.added}`
            : "Новых позиций нет — они уже добавлены") + (data.preparationMessage ? `. ${data.preparationMessage}` : ""),
        });
      } else {
        toast({
          title: "Не удалось распознать",
          description: "Позиции не найдены в документе",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Ошибка распознавания",
        description: err.message || "Не удалось обработать документ",
        variant: "destructive",
      });
    } finally {
      setIsRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <FormSectionCard
      title="Позиции заявки"
      summary={items.length ? `${items.length} поз. · из счёта или вручную` : "Заполняются из счёта или вручную"}
      sectionId="req-sec-items"
      collapsible
      defaultCollapsed
      icon={<Package className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Позиции можно заполнить из счёта: наименование, количество, единица и цена переносятся вместе.
        </p>
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1.5fr_72px_68px_104px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Артикул</span>
              <span>Наименование</span>
              <span>Кол-во</span>
              <span>Ед.</span>
              <span>Цена</span>
              <span />
            </div>

            {items.map((item, index) => (
              <div key={index} className="request-mobile-stack grid grid-cols-1 items-center gap-2 rounded-xl border border-border/60 p-2 sm:grid-cols-[1fr_1.5fr_72px_68px_104px_32px] sm:rounded-none sm:border-0 sm:p-0">
                <Input
                  aria-label={`Артикул позиции ${index + 1}`}
                  placeholder="Артикул"
                  value={item.article}
                  onChange={(e) => updateItem(index, "article", e.target.value)}
                  disabled={disabled}
                  className="h-9 min-w-0 text-sm"
                />
                <Input
                  aria-label={`Наименование позиции ${index + 1}`}
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  disabled={disabled}
                  className="h-9 min-w-0 text-sm"
                />
                <Input
                  aria-label={`Количество позиции ${index + 1}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                  disabled={disabled}
                  className="h-9 min-w-0 text-sm"
                />
                <Input
                  aria-label={`Единица позиции ${index + 1}`}
                  placeholder="шт"
                  value={item.unit || ""}
                  onChange={(e) => updateItem(index, "unit", e.target.value)}
                  disabled={disabled}
                  className="h-9 min-w-0 text-sm"
                />
                <Input
                  aria-label={`Цена позиции ${index + 1}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={item.price ?? ""}
                  onChange={(e) => updateItem(index, "price", e.target.value === "" ? null : Number(e.target.value))}
                  disabled={disabled}
                  className="h-9 min-w-0 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить позицию ${index + 1}`}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={disabled}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Добавить позицию
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.ods,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleRecognizeInvoice(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isRecognizing}
            className="h-8"
          >
            {isRecognizing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <ScanText className="h-3.5 w-3.5 mr-1" />
            )}
            Распознать позиции из счёта
          </Button>
        </div>

        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Пока позиций нет. Добавьте вручную или заполните их из счёта.
          </p>
        )}
      </div>
    </FormSectionCard>
  );
};
