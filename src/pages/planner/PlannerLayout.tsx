import { Suspense, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  Users,
  KanbanSquare,
  CalendarDays,
  ListTodo,
  ClipboardList,
  Plus,
  ChevronDown,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlannerBoardSkeleton } from "@/components/planner/PlannerBoardSkeleton";
import { PlannerQuickFab } from "@/components/planner/PlannerQuickFab";
import { PlannerFiltersBar } from "@/components/planner/PlannerFiltersBar";
import { PlannerFiltersProvider } from "@/contexts/PlannerFiltersContext";
import { PlannerViewAsProvider } from "@/contexts/PlannerViewAsContext";
import { PlannerTaskDialog } from "@/components/planner/PlannerTaskDialog";
import {
  PlannerScopeProvider,
  plannerBasePath,
  type PlannerScope,
} from "@/contexts/PlannerScopeContext";

interface Props {
  scope?: PlannerScope;
}

function buildNav(base: string) {
  return [
    { to: `${base}`, label: "Люди", icon: Users, end: true },
    { to: `${base}/board`, label: "Доска", icon: KanbanSquare },
    { to: `${base}/calendar`, label: "Календарь", icon: CalendarDays },
    { to: `${base}/tasks`, label: "Список", icon: ListTodo },
  ];
}

export default function PlannerLayout({ scope = "auto" }: Props) {
  const base = plannerBasePath(scope);
  const nav = buildNav(base);
  const navigate = useNavigate();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  return (
    <PlannerScopeProvider scope={scope}>
      <PlannerViewAsProvider>
        <PlannerFiltersProvider>
          <div className="flex flex-col h-full min-h-[calc(100dvh-3.5rem)]">
            <div className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
              <div className="px-3 sm:px-6 py-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shrink-0">
                  <ClipboardList className="h-4 w-4" />
                </div>

                <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                  {nav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <div className="ml-auto flex items-center">
                  <Button size="sm" className="h-8 rounded-r-none" onClick={() => setTaskDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Новая задача
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-8 px-2 rounded-l-none border-l border-primary-foreground/20">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`${base}/templates`)}>
                        <FileText className="h-4 w-4 mr-2" /> Шаблоны задач
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <PlannerFiltersBar />
            </div>

            <div className="flex-1 min-h-0 p-3 sm:p-6">
              <Suspense fallback={<PlannerBoardSkeleton />}>
                <Outlet />
              </Suspense>
            </div>

            <PlannerTaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} task={null} />
            <PlannerQuickFab />
          </div>
        </PlannerFiltersProvider>
      </PlannerViewAsProvider>
    </PlannerScopeProvider>
  );
}

// Convenience wrappers used in route configuration
export function CrmPlannerLayout() {
  return <PlannerLayout scope="auto" />;
}

export function MyPlannerLayout() {
  return <PlannerLayout scope="manual" />;
}
