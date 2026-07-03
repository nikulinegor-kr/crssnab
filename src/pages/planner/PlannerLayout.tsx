import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  KanbanSquare,
  CalendarDays,
  GanttChartSquare,
  FileText,
  Sun,
  ClipboardList,
  CalendarRange,
  Truck,
  MapPin,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlannerQuickFab } from "@/components/planner/PlannerQuickFab";
import { PlannerFiltersBar } from "@/components/planner/PlannerFiltersBar";
import { PlannerFiltersProvider } from "@/contexts/PlannerFiltersContext";
import { PlannerViewAsProvider, usePlannerViewAs } from "@/contexts/PlannerViewAsContext";
import {
  PlannerScopeProvider,
  plannerBasePath,
  type PlannerScope,
} from "@/contexts/PlannerScopeContext";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  scope?: PlannerScope;
}

function buildNav(base: string, isAdmin: boolean, isManual: boolean) {
  const items = [
    { to: `${base}`, label: "Сегодня", icon: Sun, end: true },
    { to: `${base}/dashboard`, label: "Обзор", icon: LayoutDashboard },
    { to: `${base}/board`, label: "Доска задач", icon: KanbanSquare },
    { to: `${base}/calendar`, label: "Календарь", icon: CalendarDays },
    { to: `${base}/timeline`, label: "План по времени", icon: GanttChartSquare },
    { to: `${base}/tasks`, label: "Список", icon: ListTodo },
    { to: `${base}/equipment`, label: "Где техника", icon: Truck },
    { to: `${base}/by-object`, label: "По объектам", icon: MapPin },
    { to: `${base}/templates`, label: "Шаблоны", icon: FileText },
  ];
  if (isAdmin && isManual) {
    items.splice(2, 0, { to: `${base}/workload`, label: "Загрузка сотрудников", icon: Users });
  }
  return items;
}

export default function PlannerLayout({ scope = "auto" }: Props) {
  const base = plannerBasePath(scope);
  const isManual = scope === "manual";
  const { isAdmin } = useUserRole();
  const nav = buildNav(base, isAdmin, isManual);
  const title = isManual ? "Мой планировщик" : "Планировщик CRM";
  const subtitle = isManual
    ? "Личные задачи: звонки, встречи, поездки и напоминания"
    : "Автоматические задачи из заявок, счетов и доставки";
  const TitleIcon = isManual ? CalendarRange : ClipboardList;

  return (
    <PlannerScopeProvider scope={scope}>
      <PlannerViewAsProvider>
      <PlannerFiltersProvider>
        <div className="flex flex-col h-full min-h-[calc(100dvh-3.5rem)]">
          <div className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
            <div className="px-3 sm:px-6 pt-4 pb-2 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
                <TitleIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold leading-none truncate">{title}</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">{subtitle}</p>
              </div>
            </div>
            <nav className="px-3 sm:px-6 flex items-center gap-1 overflow-x-auto -mb-px">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <PlannerFiltersBar />
            <ViewAsBanner />
          </div>

          <div className="flex-1 min-h-0 p-3 sm:p-6">
            <Outlet />
          </div>

          {isManual && <PlannerQuickFab />}
        </div>
      </PlannerFiltersProvider>
      </PlannerViewAsProvider>
    </PlannerScopeProvider>
  );
}

function ViewAsBanner() {
  const { canSwitch, viewedUserId, currentUserId, setViewedUserId, isSelf } = usePlannerViewAs();
  if (!canSwitch) return null;
  return (
    <div className="px-3 sm:px-6 py-1.5 flex items-center gap-2 bg-muted/10 border-t border-border/40">
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground">Просмотр планировщика:</span>
      <ViewAsSelect />
      {!isSelf && (
        <button
          type="button"
          onClick={() => setViewedUserId(currentUserId)}
          className="text-[11px] text-primary hover:underline ml-auto"
        >
          Вернуться к моему
        </button>
      )}
    </div>
  );
}

function ViewAsSelect() {
  // Lazy import to keep this file compact
  const Comp = require("@/components/planner/ViewAsSelect").ViewAsSelect;
  return <Comp />;
}

// Convenience wrappers used in route configuration
export function CrmPlannerLayout() {
  return <PlannerLayout scope="auto" />;
}

export function MyPlannerLayout() {
  return <PlannerLayout scope="manual" />;
}
