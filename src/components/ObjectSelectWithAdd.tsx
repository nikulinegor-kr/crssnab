import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ObjectSelectWithAddProps {
  value: string;
  onChange: (value: string) => void;
  objects: Array<{ id: string; name: string }> | undefined;
  organizationId: string | null;
  disabled?: boolean;
  className?: string;
}

export function ObjectSelectWithAdd({
  value,
  onChange,
  objects,
  organizationId,
  disabled = false,
  className,
}: ObjectSelectWithAddProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newObjectName, setNewObjectName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddObject = async () => {
    if (!newObjectName.trim() || !organizationId) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("request_objects")
        .insert({
          name: newObjectName.trim(),
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["request-objects"] });
      toast({ title: "Успешно", description: "Объект добавлен" });
      
      // Select the new object
      if (data) {
        onChange(data.id);
      }
      
      setNewObjectName("");
      setShowAddDialog(false);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить объект",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <div className={cn("flex w-full min-w-0 gap-1.5", className)}>
        <Select onValueChange={onChange} value={value || ""} disabled={disabled}>
          <SelectTrigger className="h-9 flex-1 min-w-0">
            <SelectValue placeholder="Выберите объект" />
          </SelectTrigger>
          <SelectContent>
            {objects?.map((obj) => (
              <SelectItem key={obj.id} value={obj.id}>
                {obj.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setShowAddDialog(true)}
            title="Добавить новый объект"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить объект</DialogTitle>
            <DialogDescription>
              Введите название нового объекта
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newObjectName}
              onChange={(e) => setNewObjectName(e.target.value)}
              placeholder="Название объекта"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newObjectName.trim()) {
                  e.preventDefault();
                  handleAddObject();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewObjectName("");
              }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleAddObject}
              disabled={!newObjectName.trim() || isAdding}
            >
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
