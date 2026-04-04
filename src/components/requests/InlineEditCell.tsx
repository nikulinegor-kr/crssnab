import { useState, useEffect, useRef } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { STATUSES, PRIORITIES } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";

interface InlineEditCellProps {
  requestId: string;
  field: "status" | "priority" | "transport_company" | "delivery_date" | "shipment_date" | "comments" | "payment_percentage" | "payment_percent" | "description" | "applicant" | "contractor" | "amount";
  value: string | number | null;
  displayValue: React.ReactNode;
  className?: string;
}

export const InlineEditCell = ({
  requestId,
  field,
  value,
  displayValue,
  className,
}: InlineEditCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value ?? ""));
  }, [value]);

  const handleSave = async () => {
    if (editValue === String(value ?? "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      let updateData: Record<string, string | number | null>;

      if (field === "payment_percentage" || field === "amount") {
        const numStr = String(editValue).replace(/[^\d.,]/g, "").replace(",", ".");
        const numValue = parseFloat(numStr);
        updateData = { [field]: isNaN(numValue) ? null : numValue };
      } else {
        updateData = { [field]: editValue || null };
      }

      const { error } = await supabase
        .from("requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: "Сохранено",
        description: "Изменения сохранены",
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ""));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  if (!isEditing) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors -mx-1",
          className
        )}
        title="Нажмите для редактирования"
      >
        {displayValue}
      </div>
    );
  }

  // Status / Priority field uses Select
  if (field === "status" || field === "priority") {
    const options = field === "status" ? STATUSES : PRIORITIES;
    const label = field === "status" ? "Статус" : "Приоритет";
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Select
          value={editValue}
          onValueChange={(val) => {
            setEditValue(val);
            setTimeout(async () => {
              setIsSaving(true);
              try {
                const { error } = await supabase
                  .from("requests")
                  .update({ [field]: val })
                  .eq("id", requestId);

                if (error) throw error;

                queryClient.invalidateQueries({ queryKey: ["requests"] });
                toast({
                  title: `${label} изменён`,
                  description: `Новое значение: ${val}`,
                });
                setIsEditing(false);
              } catch (error) {
                console.error("Error saving:", error);
                toast({
                  title: "Ошибка",
                  description: `Не удалось изменить ${label.toLowerCase()}`,
                  variant: "destructive",
                });
              } finally {
                setIsSaving(false);
              }
            }, 0);
          }}
          disabled={isSaving}
        >
          <SelectTrigger className="h-7 text-xs w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {options.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Payment percent field - saves both payment_percent and payment_status
  if (field === "payment_percentage" || field === "payment_percent") {
    const dbField = field === "payment_percent" ? "payment_percent" : "payment_percentage";
    const handlePaymentSave = async () => {
      const numValue = parseInt(String(editValue).replace("%", ""), 10);
      const finalValue = isNaN(numValue) ? 0 : Math.min(100, Math.max(0, numValue));
      
      if (finalValue === Number(value ?? 0)) {
        setIsEditing(false);
        return;
      }

      setIsSaving(true);
      try {
        const updateData: Record<string, any> = { [dbField]: finalValue };
        // Auto-compute payment_status when editing payment_percent
        if (field === "payment_percent") {
          updateData.payment_status = finalValue === 0 ? "Не оплачено" : finalValue >= 100 ? "Оплачено" : "Частично оплачено";
        }
        const { error } = await supabase
          .from("requests")
          .update(updateData)
          .eq("id", requestId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["requests"] });
        toast({
          title: "Оплата изменена",
          description: `Новое значение: ${finalValue}%`,
        });
        setIsEditing(false);
      } catch (error) {
        console.error("Error saving:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось изменить оплату",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          min="0"
          max="100"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePaymentSave();
            else if (e.key === "Escape") handleCancel();
          }}
          onBlur={handlePaymentSave}
          disabled={isSaving}
          className="h-7 text-xs w-[60px] text-center"
          placeholder="%"
        />
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    );
  }

  // Date field
  if (field === "delivery_date") {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-7 text-xs w-[120px]"
        />
        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    );
  }

  // Text fields (transport_company, comments, description, applicant)
  const getPlaceholder = () => {
    switch (field) {
      case "transport_company": return "ТК";
      case "description": return "Описание заявки";
      case "applicant": return "Заявитель";
      case "contractor": return "Контрагент";
      case "amount": return "Сумма";
      default: return "Комментарий";
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={`h-7 text-xs ${field === "description" ? "min-w-[200px]" : "min-w-[80px]"}`}
        placeholder={getPlaceholder()}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-green-600 hover:text-green-700"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
