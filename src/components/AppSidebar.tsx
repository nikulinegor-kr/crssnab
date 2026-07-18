import {
  LayoutGrid,
  FileText,
  Users,
  Settings,
  LogOut,
  FileBarChart,
  Percent,
  Sun,
  Moon,
  Building2,
  BarChart3,
  Warehouse,
  Wallet,
  Truck,
  Layers,
  FolderOpen,
  FileSpreadsheet,
  Files,
  KanbanSquare,
  Sparkles,
  ClipboardList,
  CalendarRange,
  Wrench,
  Filter,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type MenuGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    key: "crm",
    label: "CRM",
    icon: FileText,
    items: [
      { title: "Дашборд", url: "/dashboard", icon: LayoutGrid },
      { title: "Заявки", url: "/requests", icon: FileText },
      { title: "Доска", url: "/board", icon: KanbanSquare },
    ],
  },
  {
    key: "project",
    label: "Проект",
    icon: FolderOpen,
    items: [
      { title: "Ведомости материалов", url: "/material-statements", icon: FileSpreadsheet },
      { title: "Документы", url: "/documents", icon: Files },
    ],
  },
  {
    key: "erp",
    label: "ERP",
    icon: Layers,
    items: [
      { title: "Объекты", url: "/objects", icon: Building2 },
      { title: "Номенклатура", url: "/nomenclature", icon: Layers },
      { title: "Склад", url: "/warehouse", icon: Warehouse },
      { title: "Техника", url: "/equipment", icon: Truck },
      { title: "Запчасти", url: "/spare-parts", icon: Wrench },
      { title: "Фильтрующие элементы", url: "/filter-elements", icon: Filter },
    ],
  },
  {
    key: "logistics",
    label: "Логистика",
    icon: Truck,
    items: [
      { title: "Поставки", url: "/shipments", icon: Truck },
      { title: "Поставщики", url: "/suppliers", icon: Users },
    ],
  },
  {
    key: "finance",
    label: "Финансы",
    icon: Wallet,
    items: [
      { title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
      { title: "Акт агента", url: "/agent-act-report", icon: FileBarChart },
      { title: "Калькулятор %", url: "/percent-calculator", icon: Percent },
    ],
  },
  {
    key: "analytics",
    label: "Аналитика",
    icon: BarChart3,
    items: [
      { title: "Подготовка к дню", url: "/analytics/day-prep", icon: ClipboardList },
      { title: "Исполнители", url: "/analytics/executors", icon: Users },
      { title: "Заявки", url: "/analytics/requests", icon: FileText },
      { title: "Финансы", url: "/analytics/finance", icon: Wallet },
      { title: "Объекты", url: "/analytics/objects", icon: Building2 },
      { title: "Логистика", url: "/analytics/logistics", icon: Truck },
      { title: "AI Аналитик", url: "/analytics/ai", icon: Sparkles },
    ],
  },
  {
    key: "planner",
    label: "Планировщик",
    icon: CalendarRange,
    items: [
      { title: "Планировщик CRM", url: "/planner", icon: ClipboardList },
      { title: "Мой планировщик", url: "/my-planner", icon: CalendarRange },
    ],
  },
  {
    key: "journals",
    label: "Журналы",
    icon: FileBarChart,
    items: [
      { title: "Производительность", url: "/team-performance", icon: Users },
      { title: "Журнал действий", url: "/action-log", icon: FileBarChart },
    ],
  },
  {
    key: "system",
    label: "Система",
    icon: ShieldCheck,
    items: [
      { title: "Настройки", url: "/organization/settings", icon: Settings },
    ],
  },
];

const STORAGE_KEY = "sidebar:groups-open:v1";

function ThemeToggle({ showText }: { showText: boolean }) {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={toggleTheme} className="hover:bg-accent/50">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {showText && <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isViewer } = useUserRole();
  const { hasRouteAccess } = useUserPermissions();
  const totalUnread = useUnreadMessages();
  const isDemoMode = searchParams.get("demo") === "true";
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const showText = isMobile || !collapsed;

  // Which group contains the currently active route
  const activeGroupKey =
    menuGroups.find((g) =>
      g.items.some((i) => currentPath === i.url || currentPath.startsWith(i.url + "/"))
    )?.key ?? null;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  });

  // Ensure the active group is expanded whenever the route changes
  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore
    }
  }, [openGroups]);

  const handleLogout = async () => {
    if (isDemoMode) {
      navigate("/");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const renderItem = (item: MenuItem) => {
    const isActive = currentPath === item.url;
    const url = isDemoMode ? `${item.url}?demo=true` : item.url;
    const showUnread = item.url === "/chat" && totalUnread > 0;

    const button = (
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink
          to={url}
          end
          className="hover:bg-accent/50 transition-colors rounded-md relative"
          activeClassName="bg-primary/20 text-primary font-medium"
          aria-label={!showText ? item.title : undefined}
        >
          <div className="relative">
            <item.icon className="h-4 w-4" />
            {showUnread && (
              <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold">
                {totalUnread > 9 ? "9+" : totalUnread}
              </div>
            )}
          </div>
          {showText && (
            <span className="flex items-center gap-2">
              {item.title}
              {item.badge && (
                <span className="text-[9px] bg-muted text-muted-foreground rounded px-1 py-0.5 leading-none font-medium uppercase tracking-wide">
                  {item.badge}
                </span>
              )}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    );

    return (
      <SidebarMenuItem key={item.title}>
        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </SidebarMenuItem>
    );
  };

  const visibleGroups = (
    isViewer
      ? [
          {
            key: "crm",
            label: "CRM",
            icon: FileText,
            items: [{ title: "Заявки", url: "/requests", icon: FileText }],
          } as MenuGroup,
        ]
      : menuGroups
  )
    .map((g) => ({ ...g, items: g.items.filter((i) => hasRouteAccess(i.url)) }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/40 p-4">
        {showText && (
          <div className="space-y-2">
            <OrganizationSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const isGroupActive = group.key === activeGroupKey;
          const isOpen = collapsed && !isMobile ? true : !!openGroups[group.key];

          // Collapsed rail: render items directly as icons, no group toggle.
          if (collapsed && !isMobile) {
            return (
              <SidebarGroup key={group.key}>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.key} className="py-0">
              <Collapsible
                open={isOpen}
                onOpenChange={(o) =>
                  setOpenGroups((prev) => ({ ...prev, [group.key]: o }))
                }
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className={
                      "group/label flex h-8 cursor-pointer items-center justify-between px-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors " +
                      (isGroupActive ? "text-foreground" : "")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <group.icon className="h-3.5 w-3.5" />
                      {group.label}
                    </span>
                    <ChevronRight
                      className={
                        "h-3.5 w-3.5 transition-transform duration-200 " +
                        (isOpen ? "rotate-90" : "")
                      }
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden">
                  <SidebarGroupContent>
                    <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          <ThemeToggle showText={showText} />
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {showText && <span>{isDemoMode ? "Выйти из демо" : "Выход"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
