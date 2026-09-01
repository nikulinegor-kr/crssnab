import { useState, useMemo } from "react";
import { Plus, X, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { cn } from "@/lib/utils";
import { formatCompanyName, normalizeForComparison } from "@/lib/companyFormat";
import { useToast } from "@/hooks/use-toast";

interface ContractorSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  onAddNew?: (name: string, extra: { phone: string; nomenclature: string }) => Promise<void>;
  onDelete?: (value: string) => Promise<void>;
  onEdit?: (id: string, newName: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ContractorSelect({
  value,
  onChange,
  options,
  onAddNew,
  onDelete,
  onEdit,
  disabled = false,
  placeholder = "Выбрать из списка",
}: ContractorSelectProps) {
  const { toast } = useToast();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNomenclature, setNewNomenclature] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ value: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editItem, setEditItem] = useState<{ value: string; label: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Сортировка по алфавиту
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [options]);

  const filteredOptions = useMemo(() => {
    return searchQuery
      ? sortedOptions.filter((opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : sortedOptions;
  }, [sortedOptions, searchQuery]);

  // Проверка дубликата
  const checkDuplicate = (name: string, excludeId?: string): boolean => {
    const normalized = normalizeForComparison(name);
    return options.some(
      (opt) =>
        normalizeForComparison(opt.label) === normalized && opt.value !== excludeId
    );
  };

  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  const handleSelect = (selectedLabel: string) => {
    onChange(selectedLabel);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
  };

  const handleAddNew = async () => {
    if (!newName.trim() || !onAddNew) return;
    
    const formattedName = formatCompanyName(newName.trim());
    
    // Проверка на дубликат
    if (checkDuplicate(formattedName)) {
      toast({
        title: "Ошибка",
        description: "Контрагент с таким названием уже существует",
        variant: "destructive",
      });
      return;
    }
    
    setIsAdding(true);
    try {
      await onAddNew(formattedName);
      onChange(formattedName);
      setIsAddOpen(false);
      setNewName("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteConfirm.value);
      if (value === deleteConfirm.label) {
        onChange("");
      }
      setDeleteConfirm(null);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось удалить контрагента",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem || !onEdit || !editName.trim()) return;

    const formattedName = formatCompanyName(editName.trim());

    // Проверка на дубликат (исключая текущий элемент)
    if (checkDuplicate(formattedName, editItem.value)) {
      toast({
        title: "Ошибка",
        description: "Контрагент с таким названием уже существует",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);
    try {
      await onEdit(editItem.value, formattedName);
      if (value === editItem.label) {
        onChange(formattedName);
      }
      setEditItem(null);
      setEditName("");
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось обновить контрагента",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const openEditDialog = (option: { value: string; label: string }) => {
    setEditItem(option);
    setEditName(option.label);
  };

  return (
    <div className="flex w-full min-w-0 gap-2">
      {/* Основное поле с выбранным значением - клик открывает список */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogTrigger asChild>
          <div className="relative flex-1 min-w-0">
            <Input
              value={value || ""}
              readOnly
              disabled={disabled}
              placeholder={placeholder}
              className="pr-8 cursor-pointer min-w-0"
            />
            {value && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Поиск контрагента</DialogTitle>
            <DialogDescription>
              Найдите контрагента из списка
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="border rounded-lg">
            <CommandInput
              placeholder="Поиск контрагента..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const canMutate = isUuid(option.value);

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.label)}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.label ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </div>
                      <div className="flex gap-1">
                        {onEdit && canMutate && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsSearchOpen(false);
                              openEditDialog(option);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onDelete && canMutate && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsSearchOpen(false);
                              setDeleteConfirm(option);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Редактировать контрагента</DialogTitle>
            <DialogDescription>
              Измените название контрагента
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Название контрагента"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEdit();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditItem(null);
                setEditName("");
              }}
              disabled={isEditing}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleEdit}
              disabled={isEditing || !editName.trim() || editName === editItem?.label}
            >
              {isEditing ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контрагента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{deleteConfirm?.label}"? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Кнопка добавления (+) */}
      {onAddNew && (
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={disabled}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Добавить контрагента</DialogTitle>
              <DialogDescription>
                Создайте нового контрагента для быстрого выбора
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Название контрагента"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNew();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setNewName("");
                }}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleAddNew}
                disabled={isAdding || !newName.trim()}
              >
                {isAdding ? "Добавление..." : "Добавить"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
