import { 
  LayoutGrid, 
  FileText, 
  Truck, 
  Users, 
  BarChart3, 
  Calendar, 
  CheckSquare, 
  UserCircle, 
  Settings, 
  LogOut,
  FileBarChart,
  MessageCircle,
  Sparkles
} from "lucide-react";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const mainMenuItems = [
  { title: "Дашборд", url: "/dashboard", icon: LayoutGrid },
  { title: "Заявки", url: "/requests", icon: FileText },
  { title: "Поставщики", url: "/suppliers", icon: Users },
];

const secondaryMenuItems = [
  { title: "Календарь", url: "/calendar", icon: Calendar },
  { title: "Задачи", url: "/tasks", icon: CheckSquare },
  { title: "Чат", url: "/chat", icon: MessageCircle },
];

const reportMenuItems = [
  { title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
  { title: "Отчет агента по акту", url: "/agent-act-report", icon: FileBarChart },
];

const settingsMenuItems = [
  { title: "Профиль", url: "/profile", icon: UserCircle },
  { title: "Настройки", url: "/organization/settings", icon: Settings },
];

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
  // On mobile, always show text in menu
  const showText = isMobile || !collapsed;

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

  const renderMenuItems = (items: typeof mainMenuItems) => {
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
        {/* Основное меню */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(mainMenuItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Календарь и задачи */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(secondaryMenuItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Отчеты агента - показываем только для администраторов */}
        {!isDemoMode && isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(reportMenuItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        {/* Профиль и настройки */}
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
