import { NavLink, useLocation } from "react-router-dom";
import { ClipboardList, Plus, CalendarRange, Settings, LayoutDashboard } from "lucide-react";
import { useQuickRequest } from "./quick-request/QuickRequestProvider";
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
        "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
        (isActive || active) ? "text-primary" : "text-muted-foreground",
      )
    }
  >
    <Icon className="h-5 w-5" />
    <span>{label}</span>
  </NavLink>
);

export const MobileBottomNav = () => {
  const { open } = useQuickRequest();
  const location = useLocation();
  // Hide on auth/landing pages
  const hidden = ["/auth", "/employee-login", "/landing", "/"].includes(location.pathname);
  if (hidden) return null;

  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-background/95 backdrop-blur border-t border-border",
        "h-16 pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Основная навигация"
    >
      <div className="flex items-stretch h-16">
        <Item to="/dashboard" label="Главная" icon={LayoutDashboard} />
        <Item to="/requests" label="Заявки" icon={ClipboardList} />

        <button
          type="button"
          onClick={open}
          aria-label="Быстрая заявка"
          className="flex flex-col items-center justify-center flex-1 h-full"
        >
          <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform">
            <Plus className="h-6 w-6" />
          </span>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Быстро</span>
        </button>

        <Item to="/my-planner" label="Планировщик" icon={CalendarRange} />
        <Item to="/organization/settings" label="Настройки" icon={Settings} />
      </div>
    </nav>
  );
};
