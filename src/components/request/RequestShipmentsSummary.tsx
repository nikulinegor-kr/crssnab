import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRequestShipments, TRANSPORT_TYPES, type ShipmentItem } from "@/hooks/useRequestShipments";
import { Boxes, User, Phone, CalendarDays, Truck, Package } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const sb: any = supabase;

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd.MM.yyyy", { locale: ru });
  } catch {
    return d;
  }
}

function statusTone(status: string) {
  switch (status) {
    case "Завершена":
    case "Разгружена":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "В пути":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "Прибыла":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

interface Props {
  requestId: string;
}

export function RequestShipmentsSummary({ requestId }: Props) {
  const { data: shipments = [] } = useRequestShipments(requestId);
  const ids = shipments.map((s) => s.id);

  const { data: items = [] } = useQuery({
    queryKey: ["shipment-items-bulk", ids.slice().sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async (): Promise<ShipmentItem[]> => {
      const { data, error } = await sb
        .from("shipment_items")
        .select("*")
        .in("shipment_id", ids);
      if (error) throw error;
      return (data ?? []) as ShipmentItem[];
    },
  });

  if (shipments.length === 0) return null;

  const itemsBy = items.reduce<Record<string, ShipmentItem[]>>((acc, it) => {
    (acc[it.shipment_id] ||= []).push(it);
    return acc;
  }, {});

  return (
    <Card className="glassmorphism border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          Перевозки ({shipments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shipments.map((s) => {
          const tt = TRANSPORT_TYPES.find((t) => t.value === s.transport_type);
          const list = itemsBy[s.id] ?? [];
          return (
            <div key={s.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">
                  {tt?.emoji ?? "🚛"} №{s.sequence_number}
                </span>
                {s.vehicle_number && (
                  <span className="text-sm font-medium">{s.vehicle_number}</span>
                )}
                {s.trailer_number && (
                  <span className="text-xs text-muted-foreground">/ {s.trailer_number}</span>
                )}
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusTone(s.status)}`}>
                  {s.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{s.driver_name || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {s.driver_phone ? (
                    <a href={`tel:${s.driver_phone}`} className="truncate hover:text-primary">
                      {s.driver_phone}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">Выход: {fmt(s.load_date)}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="truncate">
                    Приход: {fmt(s.actual_arrival_date || s.planned_arrival_date)}
                  </span>
                </div>
              </div>

              {(s.transport_company || s.waybill_number) && (
                <div className="text-xs text-muted-foreground">
                  {s.transport_company || "—"}
                  {s.waybill_number ? ` · ТТН ${s.waybill_number}` : ""}
                </div>
              )}

              {list.length > 0 && (
                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Что едет ({list.length})
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((it) => (
                      <li key={it.id} className="text-xs flex items-baseline gap-2">
                        <span className="truncate">{it.material_name}</span>
                        <span className="text-muted-foreground font-numeric shrink-0">
                          {it.quantity ?? "—"} {it.unit ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.comment && (
                <p className="text-xs text-muted-foreground italic">{s.comment}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
