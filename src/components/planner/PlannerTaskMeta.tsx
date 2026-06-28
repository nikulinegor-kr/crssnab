import { Truck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";

interface Props {
  equipmentId?: string | null;
  objectId?: string | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Inline metadata chip showing 🚜 equipment and 📍 object on planner cards.
 * Renders nothing if neither is set.
 */
export function PlannerTaskMeta({ equipmentId, objectId, size = "sm", className }: Props) {
  const { equipmentMap, objectMap } = usePlannerLookups();
  const eq = equipmentId ? equipmentMap.get(equipmentId) : null;
  // Equipment's current object falls back when task has no explicit object.
  const objId = objectId || eq?.current_object_id || null;
  const obj = objId ? objectMap.get(objId) : null;

  if (!eq && !obj) return null;

  const text = size === "sm" ? "text-[11px]" : "text-xs";
  const iconCls = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5", text, className)}>
      {eq && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Truck className={cn(iconCls, "text-blue-500")} />
          <span className="truncate max-w-[180px]">{equipmentLabel(eq)}</span>
        </span>
      )}
      {obj && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className={cn(iconCls, "text-emerald-500")} />
          <span className="truncate max-w-[160px]">{obj.name}</span>
        </span>
      )}
    </div>
  );
}
