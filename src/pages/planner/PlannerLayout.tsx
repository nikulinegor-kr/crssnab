import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ListTodo, KanbanSquare, Sparkles, CalendarDays, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const SUB_NAV = [
  { to: "/planner", label: "Обзор", icon: LayoutDashboard, end: true },
  { to: "/planner/tasks", label: "Задачи", icon: ListTodo },
  { to: "/planner/board", label: "Канбан", icon: KanbanSquare },
  { to: "/planner/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/planner/timeline", label: "Таймлайн", icon: GanttChartSquare },
];

export default function PlannerLayout() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-3.5rem)]">
      <div className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
        <div className="px-3 sm:px-6 pt-4 pb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">Planner</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Планирование работ и задач</p>
          </div>
        </div>
        <nav className="px-3 sm:px-6 flex items-center gap-1 overflow-x-auto -mb-px">
          {SUB_NAV.map((item) => (
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
      </div>

      <div className="flex-1 min-h-0 p-3 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
