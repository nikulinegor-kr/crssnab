import { NavLink, useLocation } from "react-router-dom";
import { ClipboardList, Plus, ListChecks, Menu, House } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuickRequest } from "./quick-request/QuickRequestProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Item = ({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium transition-colors",
        (active ?? isActive) ? "text-primary" : "text-muted-foreground",
      )
    }
  >
    <Icon className="h-5 w-5" />
    <span>{label}</span>
  </NavLink>
);

export const MobileBottomNav = () => {
  const { isAdmin } = useUserRole();
  const { open } = useQuickRequest();
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  // Hide on auth/landing pages
  const hidden = ["/auth", "/employee-login", "/landing", "/"].includes(location.pathname);
  if (hidden) return null;

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-background/95 backdrop-blur border-t border-border",
        "h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Основная навигация"
    >
      <div className="flex items-stretch h-16">
        <Item to={isAdmin ? "/executive" : "/tasks?tab=mine"} label="Главная" icon={House} active={isAdmin ? location.pathname === "/executive" : location.pathname === "/tasks" && location.search.includes("tab=mine")} />
        <Item to="/requests" label="Заявки" icon={ClipboardList} />

        <Button variant="ghost"
          type="button"
          onClick={open}
          aria-label="Быстрая заявка"
          className="flex flex-col items-center justify-center flex-1 h-full rounded-none px-0"
        >
          <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform">
            <Plus className="h-6 w-6" />
          </span>
          <span className="text-xs font-medium text-muted-foreground mt-0.5">Быстро</span>
        </Button>

        <Item to="/tasks" label="Задачи" icon={ListChecks} active={location.pathname === "/tasks" && (isAdmin || !location.search.includes("tab=mine"))} />
        <Button variant="ghost"
          type="button"
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span>Меню</span>
        </Button>
      </div>
    </nav>
  );
};
