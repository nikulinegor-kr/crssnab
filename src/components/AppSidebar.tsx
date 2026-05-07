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
  ChevronDown,
  Building2,
  BarChart3,
  Warehouse,
  Wallet,
  Truck,
  Layers,
  FolderOpen,
  FileSpreadsheet,
  Files,
  Bot,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUserPermissions, ROUTE_PERMISSION_MAP } from "@/hooks/useUserPermissions";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const menuGroups = [
  {
    label: "CRM",
    icon: FileText,
    items: [
      { title: "Дашборд", url: "/dashboard", icon: LayoutGrid },
      { title: "Заявки", url: "/requests", icon: FileText },
    ],
  },
  {
    label: "Проект",
    icon: FolderOpen,
    items: [
      { title: "Ведомости материалов", url: "/material-statements", icon: FileSpreadsheet },
      { title: "Документы", url: "/documents", icon: Files },
    ],
  },
  {
    label: "ERP",
    icon: Layers,
    items: [
      { title: "Объекты", url: "/objects", icon: Building2 },
      { title: "Номенклатура", url: "/nomenclature", icon: Layers },
      { title: "Склад", url: "/warehouse", icon: Warehouse },
      { title: "Техника", url: "/equipment", icon: Truck },
      { title: "Поставщики", url: "/suppliers", icon: Users },
      { title: "Поставки", url: "/shipments", icon: Truck },
    ],
  },
  {
    label: "Финансы",
    icon: Wallet,
    items: [
      { title: "Бюджеты", url: "/budgets", icon: Wallet, badge: "скоро" },
    ],
  },
  {
    label: "Аналитика",
    icon: BarChart3,
    items: [
      { title: "AI-ассистент", url: "/ai-assistant", icon: Bot },
    ],
  },
];

const reportMenuItems = [
  { title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
  { title: "Отчет агента по акту", url: "/agent-act-report", icon: FileBarChart },
  { title: "Калькулятор %", url: "/percent-calculator", icon: Percent },
];

const settingsMenuItems = [
  { title: "Настройки", url: "/organization/settings", icon: Settings },
];

function ThemeToggle({ showText }: { showText: boolean }) {
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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
  const { isAdmin, isViewer } = useUserRole();
  const { hasPermission, hasRouteAccess } = useUserPermissions();
  const totalUnread = useUnreadMessages();
  const isDemoMode = searchParams.get("demo") === "true";
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const showText = isMobile || !collapsed;

  const allPaths = menuGroups.flatMap(g => g.items.map(i => i.url));

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

  const renderMenuItems = (items: { title: string; url: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[]) => {
    return items.filter(item => hasRouteAccess(item.url)).map((item) => {
      const isActive = currentPath === item.url;
      const url = isDemoMode ? `${item.url}?demo=true` : item.url;
      const showUnread = item.url === "/chat" && totalUnread > 0;

      const menuButton = (
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
                {showUnread && (
                  <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-2 py-0.5 font-semibold">
                    {totalUnread > 99 ? "99+" : totalUnread}
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
              <TooltipTrigger asChild>
                {menuButton}
              </TooltipTrigger>
              <TooltipContent side="right">{item.title}</TooltipContent>
            </Tooltip>
          ) : (
            menuButton
          )}
        </SidebarMenuItem>
      );
    });
  };

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
        {(isViewer
          ? [{ label: "CRM", icon: FileText, items: [{ title: "Заявки", url: "/requests", icon: FileText }] }]
          : menuGroups
        ).filter(group => {
          // Filter groups where at least one item is accessible
          return group.items.some(item => hasRouteAccess(item.url));
        }).map((group, idx) => {
          const isGroupActive = group.items.some(i => currentPath.startsWith(i.url));
          return (
            <div key={group.label}>
              {idx > 0 && <SidebarSeparator />}
              <SidebarGroup>
                {showText && (
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 pt-2">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderMenuItems(group.items)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {/* Отчёты внутри блока Аналитика */}
              {group.label === "Аналитика" && !isDemoMode && (isAdmin || hasPermission("analytics.reports" as any)) && (
                <Collapsible defaultOpen={false} className="group/collapsible-reports">
                  <SidebarGroup className="pt-0">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full justify-between hover:bg-accent/50">
                        <div className="flex items-center gap-2">
                          <FileBarChart className="h-4 w-4" />
                          {showText && <span>Отчёты</span>}
                        </div>
                        {showText && (
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible-reports:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu className="pl-2">
                          {renderMenuItems(reportMenuItems)}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              )}
            </div>
          );
        })}

        {/* Настройки — скрыты для наблюдателей */}
        {!isViewer && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {!isDemoMode && renderMenuItems(settingsMenuItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
