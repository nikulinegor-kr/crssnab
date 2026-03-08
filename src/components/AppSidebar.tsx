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
  Package,
  ChevronDown,
  Building2,
  BarChart3,
  FolderOpen,
  UsersRound,
  Warehouse,
  Wallet,
  ShoppingCart,
  Truck,
  Layers,
  Boxes,
  ClipboardList,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
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

const crmMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutGrid },
  { title: "Заявки", url: "/requests", icon: FileText },
  { title: "Контрагенты", url: "/suppliers", icon: Users },
  { title: "Объекты", url: "/objects", icon: Building2 },
  { title: "Документы", url: "/documents", icon: FolderOpen },
  { title: "Аналитика", url: "/analytics", icon: BarChart3 },
  { title: "Команда", url: "/team", icon: UsersRound },
];

const erpMenuItems = [
  { title: "Номенклатура", url: "/nomenclature", icon: Layers },
  { title: "Техника", url: "/equipment", icon: Truck },
  { title: "Склад", url: "/warehouse", icon: Warehouse },
  { title: "Поставки", url: "/shipments", icon: Truck },
  { title: "Бюджеты", url: "/budgets", icon: Wallet },
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
  const { isAdmin } = useUserRole();
  const totalUnread = useUnreadMessages();
  const isDemoMode = searchParams.get("demo") === "true";
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const showText = isMobile || !collapsed;

  // Determine which section is active for default open state
  const erpPaths = erpMenuItems.map(i => i.url);
  const isErpActive = erpPaths.some(p => currentPath.startsWith(p));

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

  const renderMenuItems = (items: typeof crmMenuItems) => {
    return items.map((item) => {
      const isActive = currentPath === item.url;
      const url = isDemoMode ? `${item.url}?demo=true` : item.url;
      const showBadge = item.url === "/chat" && totalUnread > 0;
      
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive}>
            <NavLink 
              to={url} 
              end 
              className="hover:bg-accent/50 transition-colors rounded-md relative"
              activeClassName="bg-primary/20 text-primary font-medium"
            >
              <div className="relative">
                <item.icon className="h-4 w-4" />
                {showBadge && (
                  <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </div>
                )}
              </div>
              {showText && (
                <span className="flex items-center gap-2">
                  {item.title}
                  {showBadge && (
                    <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-2 py-0.5 font-semibold">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          </SidebarMenuButton>
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
        {/* CRM Section */}
        <Collapsible defaultOpen={!isErpActive} className="group/collapsible-crm">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="w-full justify-between hover:bg-accent/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {showText && <span className="font-semibold text-xs uppercase tracking-wider">CRM</span>}
                </div>
                {showText && (
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible-crm:rotate-180" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(crmMenuItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* ERP Section */}
        <Collapsible defaultOpen={isErpActive} className="group/collapsible-erp">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="w-full justify-between hover:bg-accent/50">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {showText && <span className="font-semibold text-xs uppercase tracking-wider">ERP</span>}
                </div>
                {showText && (
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible-erp:rotate-180" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(erpMenuItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* Отчеты - только для администраторов */}
        {!isDemoMode && isAdmin && (
          <>
            <Collapsible defaultOpen={false} className="group/collapsible-reports">
              <SidebarGroup>
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
            <SidebarSeparator />
          </>
        )}

        {/* Настройки */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isDemoMode && renderMenuItems(settingsMenuItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
