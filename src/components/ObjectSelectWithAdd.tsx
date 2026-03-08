import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Loader2, ChevronsUpDown, Search, Building2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!objects) return [];
    if (!search) return objects;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return objects.filter((obj) => {
      const haystack = obj.name.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [objects, search]);

  const selectedObject = objects?.find((o) => o.id === value);

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn("flex-1 min-w-0 justify-between h-9 text-sm font-normal", !value && "text-muted-foreground")}
            >
              <span className="truncate">
                {selectedObject ? selectedObject.name : "Выберите объект"}
              </span>
              <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <div className="max-h-[250px] overflow-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Не найдено</p>
              ) : (
                filtered.map((obj) => (
                  <button
                    key={obj.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer flex items-center gap-2",
                      obj.id === value && "bg-accent"
                    )}
                    onClick={() => {
                      onChange(obj.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{obj.name}</span>
                  </button>
                ))
              )}
            </div>
            {!disabled && (
              <div className="border-t p-1">
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer flex items-center gap-2 text-primary"
                  onClick={() => {
                    setOpen(false);
                    setShowAddDialog(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить объект
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
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