import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
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
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractorSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  onAddNew?: (name: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ContractorSelect({
  value,
  onChange,
  options,
  onAddNew,
  disabled = false,
  placeholder = "Выбрать из списка",
}: ContractorSelectProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = searchQuery
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

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
    
    setIsAdding(true);
    try {
      await onAddNew(newName.trim());
      onChange(newName.trim());
      setIsAddOpen(false);
      setNewName("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Основное поле с выбранным значением */}
      <div className="relative flex-1">
        <Input
          value={value || ""}
          readOnly
          disabled={disabled}
          placeholder={placeholder}
          className="pr-8"
        />
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Кнопка поиска (лупа) */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={disabled}
          >
            <Search className="h-4 w-4" />
          </Button>
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
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.label)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.label ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

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
