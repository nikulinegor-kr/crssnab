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
  FileBarChart
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
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
  { title: "Поставки", url: "/requests", icon: Truck },
  { title: "Поставщики", url: "/suppliers", icon: Users },
  { title: "Аналитика", url: "/requests", icon: BarChart3 },
];

const secondaryMenuItems = [
  { title: "Календарь", url: "/dashboard", icon: Calendar },
  { title: "Задачи", url: "/requests", icon: CheckSquare },
];

const reportMenuItems = [
  { title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
  { title: "Отчет агента - УУ", url: "/agent-report-uu", icon: FileBarChart },
];

const settingsMenuItems = [
  { title: "Профиль", url: "/organization/settings", icon: UserCircle },
  { title: "Настройки", url: "/organization/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
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
      
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive}>
            <NavLink 
              to={url} 
              end 
              className="hover:bg-accent/50 transition-colors rounded-md"
              activeClassName="bg-primary/20 text-primary font-medium"
            >
              <item.icon className="h-4 w-4" />
              {showText && <span>{item.title}</span>}
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

        {/* Отчеты агента - показываем только не в демо режиме */}
        {!isDemoMode && (
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
