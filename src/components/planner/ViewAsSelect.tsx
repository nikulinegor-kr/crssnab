import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePlannerViewAs } from "@/contexts/PlannerViewAsContext";

export function ViewAsSelect() {
  const { data: members = [] } = useOrgMembers();
  const { viewedUserId, setViewedUserId, currentUserId } = usePlannerViewAs();
  const value = viewedUserId ?? currentUserId ?? "";

  return (
    <Select value={value} onValueChange={(v) => setViewedUserId(v || null)}>
      <SelectTrigger className="h-7 text-xs w-auto min-w-[180px] max-w-[260px] px-2 gap-1.5">
        <SelectValue placeholder="Сотрудник" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {currentUserId && (
          <SelectItem value={currentUserId}>Мой планировщик</SelectItem>
        )}
        {members
          .filter((m) => m.user_id !== currentUserId)
          .map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || "—"}
              {m.position ? ` · ${m.position}` : ""}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
