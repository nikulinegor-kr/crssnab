import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface EquipmentSidebarProps {
  organizationId: string | null;
}

export const EquipmentSidebar = ({ organizationId }: EquipmentSidebarProps) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, year, vin, plate_number")
        .eq("organization_id", organizationId!)
        .order("brand")
        .order("model");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const filtered = useMemo(() => {
    if (!search) return equipment;
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return equipment.filter((e: any) => {
      const haystack = [e.brand, e.model, e.vin, e.plate_number, e.year?.toString()]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [equipment, search]);

  // Group by brand
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const brand = e.brand || "Без марки";
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand)!.push(e);
    }
    return map;
  }, [filtered]);

  if (collapsed) {
    return (
      <div className="w-10 border-r bg-muted/30 flex flex-col items-center pt-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mt-2 writing-mode-vertical text-xs text-muted-foreground font-medium [writing-mode:vertical-lr] rotate-180">
          Техника ({equipment.length})
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-muted/20 flex flex-col shrink-0">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Truck className="h-4 w-4 text-primary" />
          Техника
          <Badge variant="secondary" className="text-xs h-5 px-1.5">{equipment.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

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

      <ScrollArea className="flex-1">
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Не найдено</p>
          ) : (
            Array.from(grouped.entries()).map(([brand, items]) => (
              <div key={brand} className="mb-1">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {brand} <span className="text-muted-foreground/60">({items.length})</span>
                </div>
                {items.map((e: any) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer flex flex-col gap-0.5 transition-colors"
                    onClick={() => navigate(`/equipment/${e.id}`)}
                  >
                    <span className="font-medium truncate">
                      {e.model || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[
                        e.year,
                        e.plate_number,
                        e.vin ? `VIN ${e.vin.slice(-6)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
