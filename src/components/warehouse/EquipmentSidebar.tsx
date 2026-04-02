import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EquipmentSidebarProps {
  organizationId: string | null;
}

export const EquipmentSidebar = ({ organizationId }: EquipmentSidebarProps) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, year, vin, plate_number, comment")
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по марке, модели, VIN, гос. номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} из {equipment.length}</Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Марка</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead>Год</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Гос. номер</TableHead>
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="h-8 w-8 text-muted-foreground/40" />
                    <span>Техника не найдена</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e: any) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/equipment/${e.id}`)}
                >
                  <TableCell className="font-medium">{e.brand || "—"}</TableCell>
                  <TableCell>{e.model || "—"}</TableCell>
                  <TableCell>{e.year || "—"}</TableCell>
                  <TableCell className="font-numeric">{e.vin || "—"}</TableCell>
                  <TableCell>{e.plate_number || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {e.comment || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
