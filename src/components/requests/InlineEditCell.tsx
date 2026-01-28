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
import { STATUSES } from "@/hooks/useRequestsFilters";
import { cn } from "@/lib/utils";

interface InlineEditCellProps {
  requestId: string;
  field: "status" | "transport_company" | "delivery_date" | "comments";
  value: string | null;
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
  const [editValue, setEditValue] = useState(value || "");
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
    setEditValue(value || "");
  }, [value]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, string | null> = {
        [field]: editValue || null,
      };

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
    setEditValue(value || "");
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

  // Status field uses Select
  if (field === "status") {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Select
          value={editValue}
          onValueChange={(val) => {
            setEditValue(val);
            // Auto-save on status change
            setTimeout(async () => {
              setIsSaving(true);
              try {
                const { error } = await supabase
                  .from("requests")
                  .update({ status: val })
                  .eq("id", requestId);

                if (error) throw error;

                queryClient.invalidateQueries({ queryKey: ["requests"] });
                toast({
                  title: "Статус изменён",
                  description: `Новый статус: ${val}`,
                });
                setIsEditing(false);
              } catch (error) {
                console.error("Error saving:", error);
                toast({
                  title: "Ошибка",
                  description: "Не удалось изменить статус",
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
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="text-xs">
                {status}
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

  // Text fields (transport_company, comments)
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="h-7 text-xs min-w-[80px]"
        placeholder={field === "transport_company" ? "ТК" : "Комментарий"}
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
