import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Layers, MapPin, Truck, User, Flag, Search } from "lucide-react";
import { usePlannerFilters } from "@/contexts/PlannerFiltersContext";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PRIORITY_META, type PlannerTaskPriority } from "@/hooks/usePlannerTasks";
import { usePlannerLookups, equipmentLabel } from "@/hooks/usePlannerEquipment";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PRIORITY_META, type PlannerTaskPriority } from "@/hooks/usePlannerTasks";

const NONE = "__none__";

export function PlannerFiltersBar() {
  const f = usePlannerFilters();
  const { equipment, objects } = usePlannerLookups();
  const { data: members = [] } = useOrgMembers();

  const visibleEquipment = f.objectId
    ? equipment.filter((e) => e.current_object_id === f.objectId)
    : equipment;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 py-2 border-b border-border/40 bg-muted/20">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Layers className="h-3 w-3" /> Фильтры:
      </div>

      <FilterSelect
        icon={<MapPin className="h-3 w-3" />}
        value={f.objectId}
        onChange={(v) => { f.setObjectId(v); if (v && f.equipmentId) {
          const eq = equipment.find((e) => e.id === f.equipmentId);
          if (eq && eq.current_object_id !== v) f.setEquipmentId(null);
        }}}
        placeholder="Объект"
        options={objects.map((o) => ({ value: o.id, label: o.name }))}
      />

      <FilterSelect
        icon={<Truck className="h-3 w-3" />}
        value={f.equipmentId}
        onChange={(v) => {
          f.setEquipmentId(v);
          if (v) {
            const eq = equipment.find((e) => e.id === v);
            if (eq?.current_object_id && !f.objectId) f.setObjectId(eq.current_object_id);
          }
        }}
        placeholder="Техника"
        options={visibleEquipment.map((e) => ({ value: e.id, label: equipmentLabel(e) }))}
      />

      <FilterSelect
        icon={<User className="h-3 w-3" />}
        value={f.assigneeId}
        onChange={f.setAssigneeId}
        placeholder="Исполнитель"
        options={members.map((m) => ({ value: m.user_id, label: m.full_name || m.email || "—" }))}
      />

      <FilterSelect
        icon={<Flag className="h-3 w-3" />}
        value={f.priority}
        onChange={(v) => f.setPriority(v as PlannerTaskPriority | null)}
        placeholder="Приоритет"
        options={(Object.keys(PRIORITY_META) as PlannerTaskPriority[]).map((p) => ({
          value: p, label: PRIORITY_META[p].label,
        }))}
      />

      <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-border/40">
        <span className="text-[11px] text-muted-foreground">Группа:</span>
        <Select value={f.groupBy} onValueChange={(v) => f.setGroupBy(v as any)}>
          <SelectTrigger className="h-7 text-xs w-auto px-2 gap-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без группировки</SelectItem>
            <SelectItem value="object">По объекту</SelectItem>
            <SelectItem value="equipment">По технике</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {f.hasActive && (
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={f.reset}>
          <X className="h-3 w-3 mr-1" /> Сбросить
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  icon, value, onChange, placeholder, options,
}: {
  icon: React.ReactNode;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-7 text-xs w-auto min-w-[120px] max-w-[180px] px-2 gap-1.5">
        {icon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>{placeholder} — все</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
