import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSectionCard } from "./FormSectionCard";
import { Package, Plus, Trash2, ScanText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RequestItem {
  article: string;
  name: string;
  quantity: number;
}

interface RequestItemsSectionProps {
  items: RequestItem[];
  onItemsChange: (items: RequestItem[]) => void;
  disabled?: boolean;
}

export const RequestItemsSection = ({
  items,
  onItemsChange,
  disabled = false,
}: RequestItemsSectionProps) => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addItem = () => {
    onItemsChange([...items, { article: "", name: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RequestItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onItemsChange(updated);
  };

  const handleRecognizeInvoice = async (file: File) => {
    setIsRecognizing(true);
    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke("recognize-invoice", {
        body: { file: base64, fileName: file.name, fileType: file.type },
      });

      if (error) throw error;

      if (data?.items?.length) {
        const newItems: RequestItem[] = data.items.map((item: any) => ({
          article: item.article || "",
          name: item.name || "",
          quantity: item.quantity || 1,
        }));
        onItemsChange([...items, ...newItems]);
        toast({
          title: "Распознано",
          description: `Добавлено ${newItems.length} позиций из счёта`,
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <FormSectionCard
      title="Позиции заявки"
      icon={<Package className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        {items.length > 0 && (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Артикул</span>
              <span>Наименование</span>
              <span>Кол-во</span>
              <span />
            </div>

            {/* Rows */}
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-2 items-center">
                <Input
                  placeholder="Артикул"
                  value={item.article}
                  onChange={(e) => updateItem(index, "article", e.target.value)}
                  disabled={disabled}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  disabled={disabled}
                  className="h-9 text-sm"
                />
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                  disabled={disabled}
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleRecognizeInvoice(f);
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
            Распознать счёт
          </Button>
        </div>

        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Добавьте позиции вручную или загрузите счёт для автоматического распознавания
          </p>
        )}
      </div>
    </FormSectionCard>
  );
};
