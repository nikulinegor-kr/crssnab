import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { useOrgMembers, initialsOf } from "@/hooks/useOrgMembers";
import { usePlannerViewAs } from "@/contexts/PlannerViewAsContext";
import { usePlannerScope, plannerBasePath } from "@/contexts/PlannerScopeContext";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isPast, isToday, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { Users, AlertCircle, CalendarDays, ListTodo } from "lucide-react";

interface Row {
  user_id: string;
  name: string;
  position: string | null;
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  loadPct: number;
}

const CAPACITY = 15; // reference active tasks = 100% load

export default function PlannerWorkload() {
  const navigate = useNavigate();
  const scope = usePlannerScope();
  const { currentOrgId } = useCurrentOrganization();
  const { data: members = [] } = useOrgMembers();
  const { setViewedUserId } = usePlannerViewAs();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["planner-workload-tasks", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [];
      const { data, error } = await supabase
        .from("planner_tasks")
        .select("id, assignee_id, created_by, status, due_date, start_date")
        .eq("organization_id", currentOrgId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrgId,
  });

  const rows = useMemo<Row[]>(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    return members.map((m) => {
      const mine = tasks.filter(
        (t) => (t.assignee_id === m.user_id || t.created_by === m.user_id) && t.status !== "done"
      );
      const overdue = mine.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;
      const todayCount = mine.filter((t) => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return !isBefore(d, todayStart) && !isAfter(d, todayEnd);
      }).length;
      const upcoming = mine.filter((t) => t.due_date && isAfter(new Date(t.due_date), todayEnd)).length;
      const loadPct = Math.min(100, Math.round((mine.length / CAPACITY) * 100));
      return {
        user_id: m.user_id,
        name: m.full_name || m.email || "—",
        position: m.position,
        total: mine.length,
        overdue,
        today: todayCount,
        upcoming,
        loadPct,
      };
    }).sort((a, b) => b.total - a.total);
  }, [members, tasks]);

  const openMember = (userId: string) => {
    setViewedUserId(userId);
    navigate(`${plannerBasePath(scope)}/dashboard`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold leading-none">Загрузка сотрудников</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Задачи в работе по каждому сотруднику. Нажмите на карточку — откроется его планировщик.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Загрузка…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">В организации пока нет сотрудников.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <Card
              key={r.user_id}
              onClick={() => openMember(r.user_id)}
              className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-xs">
                    {initialsOf({ full_name: r.name })}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.name}</div>
                  {r.position && <div className="text-[11px] text-muted-foreground truncate">{r.position}</div>}
                </div>
                <Badge variant="outline" className="font-numeric">{r.total} задач</Badge>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Загрузка</span>
                  <span className="font-numeric">{r.loadPct}%</span>
                </div>
                <Progress value={r.loadPct} className="h-1.5" />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Stat icon={<AlertCircle className="h-3 w-3" />} label="Просрочено" value={r.overdue} tone={r.overdue > 0 ? "danger" : "muted"} />
                <Stat icon={<CalendarDays className="h-3 w-3" />} label="Сегодня" value={r.today} tone={r.today > 0 ? "primary" : "muted"} />
                <Stat icon={<ListTodo className="h-3 w-3" />} label="Ближайшие" value={r.upcoming} tone="muted" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "danger" | "primary" | "muted" }) {
  const cls =
    tone === "danger" ? "text-destructive" :
    tone === "primary" ? "text-primary" :
    "text-muted-foreground";
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <div className={`flex items-center justify-center gap-1 text-[10px] ${cls}`}>{icon}{label}</div>
      <div className={`text-sm font-semibold font-numeric ${cls}`}>{value}</div>
    </div>
  );
}
