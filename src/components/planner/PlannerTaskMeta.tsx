import { Truck, MapPin, Flag, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PRIORITY_META, type PlannerTaskPriority } from "@/hooks/usePlannerTasks";

interface Props {
  equipmentId?: string | null;
  equipmentIds?: string[] | null;
  objectId?: string | null;
  priority?: PlannerTaskPriority | null;
  assigneeId?: string | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Inline metadata chip showing 📍 object, 🚜 equipment (with multi-select support),
 * priority, and assignee on planner cards. Renders nothing if there's nothing to show.
 */
export function PlannerTaskMeta({
  equipmentId,
  equipmentIds,
  objectId,
  priority,
  assigneeId,
  size = "sm",
  className,
}: Props) {
  const { equipmentMap, objectMap } = usePlannerLookups();
  const { data: members = [] } = useOrgMembers();

  const ids = (equipmentIds?.length ? equipmentIds : (equipmentId ? [equipmentId] : []))
    .map((id) => equipmentMap.get(id))
    .filter(Boolean) as ReturnType<typeof equipmentMap.get>[];
  const eqList = ids.filter(Boolean) as NonNullable<ReturnType<typeof equipmentMap.get>>[];

  const objId = objectId || eqList[0]?.current_object_id || null;
  const obj = objId ? objectMap.get(objId) : null;
  const assignee = assigneeId ? members.find((m) => m.user_id === assigneeId) : null;
  const pr = priority ? PRIORITY_META[priority] : null;

  if (eqList.length === 0 && !obj && !pr && !assignee) return null;

  const text = size === "sm" ? "text-[11px]" : "text-xs";
  const iconCls = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5", text, className)}>
      {obj && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className={cn(iconCls, "text-emerald-500")} />
          <span className="truncate max-w-[160px]">{obj.name}</span>
        </span>
      )}
      {eqList.length > 0 && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Truck className={cn(iconCls, "text-blue-500")} />
          <span className="truncate max-w-[220px]">
            {equipmentLabel(eqList[0])}
            {eqList.length > 1 && ` +${eqList.length - 1}`}
          </span>
        </span>
      )}
      {pr && (
        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium", pr.className)}>
          <Flag className={iconCls} /> {pr.label}
        </span>
      )}
      {assignee && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <UserIcon className={iconCls} />
          <span className="truncate max-w-[140px]">{assignee.full_name || assignee.email || "—"}</span>
        </span>
      )}
    </div>
  );
}
