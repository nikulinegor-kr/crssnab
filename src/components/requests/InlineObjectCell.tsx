import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface InlineObjectCellProps {
  requestId: string;
  organizationId: string | null | undefined;
  objectId: string | null | undefined;
  displayValue: React.ReactNode;
  className?: string;
}

export function InlineObjectCell({
  requestId,
  organizationId,
  objectId,
  displayValue,
  className,
}: InlineObjectCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: objects, isLoading } = useQuery({
    queryKey: ["request-objects", organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_objects")
        .select("id, name")
        .eq("organization_id", organizationId as string)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const filtered = useMemo(() => {
    const list = objects ?? [];
    if (!search.trim()) return list;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((o) => words.every((w) => o.name.toLowerCase().includes(w)));
  }, [objects, search]);

  const save = async (newId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("requests")
        .update({ object_id: newId })
        .eq("id", requestId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Сохранено", description: "Объект обновлён" });
      setOpen(false);
      setSearch("");
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось сохранить объект",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 transition-colors",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : displayValue}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск объекта..."
              className="h-8 pl-7 text-[13px]"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted"
            onClick={() => save(null)}
          >
            — Без объекта
          </button>
          {isLoading && (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">Загрузка...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">Ничего не найдено</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted",
                o.id === objectId && "bg-muted font-medium"
              )}
              onClick={() => save(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
